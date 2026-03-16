;; Mock sBTC Token
;; A minimal SIP-010 fungible token for testnet testing.
;; Anyone can mint tokens to themselves -- not for production use.

(define-fungible-token mock-sbtc)

;; SIP-010 functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err u4))
    (try! (ft-transfer? mock-sbtc amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock sBTC")
)

(define-read-only (get-symbol)
  (ok "msBTC")
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-sbtc account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-sbtc))
)

(define-read-only (get-token-uri)
  (ok none)
)

;; Testnet-only: anyone can mint tokens to themselves.
(define-public (mint (amount uint))
  (ft-mint? mock-sbtc amount tx-sender)
)
