;; Paygent Escrow Contract v3 -- SIP-010 Token Support
;; Trustless machine-to-machine payments between AI agents on Stacks.
;; Payment held in escrow, released only upon cryptographically verified delivery.
;;
;; This version accepts any SIP-010 fungible token (sBTC, USDCx, etc.)
;; instead of native STX transfers.
;;
;; Trait reference: update the contract address below based on deployment.
;; For testnet, deploy sip-010-trait.clar first, then reference the deployer address.
;; For mainnet, use: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard

(use-trait ft-trait .sip-010-trait.sip-010-trait)

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
    amount: uint,
    token: principal,
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
(define-constant ERR-TOKEN-MISMATCH (err u7))

;; Agent A locks payment and creates a job.
;; request-hash: SHA256 of the request payload -- commits to what Agent A is paying for.
;; token: the SIP-010 token contract to use for payment.
(define-public (create-escrow
    (provider principal)
    (amount uint)
    (provider-pubkey (buff 33))
    (request-hash (buff 32))
    (token <ft-trait>))
  (let
    (
      (job-id (+ (var-get job-counter) u1))
    )
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (var-set job-counter job-id)
    (map-set escrows
      { job-id: job-id }
      {
        requester: tx-sender,
        provider: provider,
        amount: amount,
        token: (contract-of token),
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
;; token must match the token stored when the escrow was created.
(define-public (complete-escrow (job-id uint) (result-hash (buff 32)) (signature (buff 65)) (token <ft-trait>))
  (let
    (
      (escrow (unwrap! (map-get? escrows { job-id: job-id }) ERR-NOT-FOUND))
      (provider (get provider escrow))
      (amount (get amount escrow))
      (status (get status escrow))
      (pubkey (get provider-pubkey escrow))
    )
    (asserts! (is-eq status "pending") ERR-NOT-PENDING)
    (asserts! (is-eq tx-sender provider) ERR-UNAUTHORIZED)
    (asserts! (is-eq (contract-of token) (get token escrow)) ERR-TOKEN-MISMATCH)
    (asserts! (secp256k1-verify result-hash signature pubkey) ERR-INVALID-SIG)
    (map-set escrows { job-id: job-id }
      (merge escrow { status: "completed", result-hash: result-hash })
    )
    (try! (as-contract (contract-call? token transfer amount tx-sender provider none)))
    (ok true)
  )
)

;; Agent A reclaims funds after 144 blocks (~24h) if Agent B never delivered.
;; token must match the token stored when the escrow was created.
(define-public (refund-escrow (job-id uint) (token <ft-trait>))
  (let
    (
      (escrow (unwrap! (map-get? escrows { job-id: job-id }) ERR-NOT-FOUND))
      (requester (get requester escrow))
      (amount (get amount escrow))
      (status (get status escrow))
      (created-at (get created-at escrow))
    )
    (asserts! (is-eq status "pending") ERR-NOT-PENDING)
    (asserts! (is-eq tx-sender requester) ERR-UNAUTHORIZED)
    (asserts! (is-eq (contract-of token) (get token escrow)) ERR-TOKEN-MISMATCH)
    (asserts! (>= block-height (+ created-at u144)) ERR-TOO-EARLY)
    (map-set escrows { job-id: job-id }
      (merge escrow { status: "refunded" })
    )
    (try! (as-contract (contract-call? token transfer amount tx-sender requester none)))
    (ok true)
  )
)

(define-read-only (get-escrow (job-id uint))
  (ok (map-get? escrows { job-id: job-id }))
)

(define-read-only (get-job-count)
  (ok (var-get job-counter))
)
