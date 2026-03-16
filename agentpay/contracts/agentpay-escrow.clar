;; Paygent Escrow Contract
;; Trustless machine-to-machine payments between AI agents on Stacks.
;; Payment held in escrow, released only upon cryptographically verified delivery.

;; secp256k1-verify takes 3 arguments:
;;   (secp256k1-verify message-hash signature public-key)
;;   - message-hash: (buff 32)
;;   - signature: (buff 65) - recoverable signature
;;   - public-key: (buff 33) - compressed public key

(define-map escrows
  { job-id: uint }
  {
    requester: principal,
    provider: principal,
    amount-ustx: uint,
    status: (string-ascii 20),
    request-hash: (buff 32),
    result-hash: (buff 32),
    created-at: uint,
    provider-pubkey: (buff 33)
  }
)

(define-data-var job-counter uint u0)

;; Error codes
(define-constant ERR-TRANSFER-FAILED (err u1))
(define-constant ERR-NOT-FOUND (err u2))
(define-constant ERR-NOT-PENDING (err u3))
(define-constant ERR-UNAUTHORIZED (err u4))
(define-constant ERR-INVALID-SIG (err u5))
(define-constant ERR-TOO-EARLY (err u6))

;; Agent A locks payment and creates a job.
;; request-hash: SHA256 of the request payload - commits to what Agent A is paying for.
(define-public (create-escrow
    (provider principal)
    (amount-ustx uint)
    (provider-pubkey (buff 33))
    (request-hash (buff 32)))
  (let
    (
      (job-id (+ (var-get job-counter) u1))
    )
    (try! (stx-transfer? amount-ustx tx-sender (as-contract tx-sender)))
    (var-set job-counter job-id)
    (map-set escrows
      { job-id: job-id }
      {
        requester: tx-sender,
        provider: provider,
        amount-ustx: amount-ustx,
        status: "pending",
        request-hash: request-hash,
        result-hash: 0x0000000000000000000000000000000000000000000000000000000000000000,
        created-at: block-height,
        provider-pubkey: provider-pubkey
      }
    )
    (ok job-id)
  )
)

;; Agent B submits signed proof of delivery to claim payment.
;; Contract verifies the signature on-chain before releasing funds.
(define-public (complete-escrow (job-id uint) (result-hash (buff 32)) (signature (buff 65)))
  (let
    (
      (escrow (unwrap! (map-get? escrows { job-id: job-id }) ERR-NOT-FOUND))
      (provider (get provider escrow))
      (amount (get amount-ustx escrow))
      (status (get status escrow))
      (pubkey (get provider-pubkey escrow))
    )
    (asserts! (is-eq status "pending") ERR-NOT-PENDING)
    (asserts! (is-eq tx-sender provider) ERR-UNAUTHORIZED)
    (asserts! (secp256k1-verify result-hash signature pubkey) ERR-INVALID-SIG)
    (map-set escrows { job-id: job-id }
      (merge escrow { status: "completed", result-hash: result-hash })
    )
    (try! (as-contract (stx-transfer? amount tx-sender provider)))
    (ok true)
  )
)

;; Agent A reclaims funds after 144 blocks (~24h) if Agent B never delivered.
(define-public (refund-escrow (job-id uint))
  (let
    (
      (escrow (unwrap! (map-get? escrows { job-id: job-id }) ERR-NOT-FOUND))
      (requester (get requester escrow))
      (amount (get amount-ustx escrow))
      (status (get status escrow))
      (created-at (get created-at escrow))
    )
    (asserts! (is-eq status "pending") ERR-NOT-PENDING)
    (asserts! (is-eq tx-sender requester) ERR-UNAUTHORIZED)
    (asserts! (>= block-height (+ created-at u144)) ERR-TOO-EARLY)
    (map-set escrows { job-id: job-id }
      (merge escrow { status: "refunded" })
    )
    (try! (as-contract (stx-transfer? amount tx-sender requester)))
    (ok true)
  )
)

(define-read-only (get-escrow (job-id uint))
  (ok (map-get? escrows { job-id: job-id }))
)

(define-read-only (get-job-count)
  (ok (var-get job-counter))
)
