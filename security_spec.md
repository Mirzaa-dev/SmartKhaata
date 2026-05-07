# Security Specification for SmartKhata

## Data Invariants
1. A **Customer** must always be associated with a valid **Shopkeeper (User)** ID.
2. A **Transaction** must always reference an existing **Customer** and the **Shopkeeper** who initiated it.
3. Only the **Shopkeeper** who owns a **Customer** record can read, update, or delete that record.
4. **Transactions** can only be created or viewed by the associated **Shopkeeper**.
5. **Trust Scores** and **Risk Levels** are calculated based on transaction history and should not be arbitrarily modifiable by the client without a valid transaction sequence (though in this client-side demo, we allow updates with validation).
6. **User** profiles are private to the authenticated owner.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a customer for another shopkeeper.
```json
{
  "shopkeeperId": "attacker_uid",
  "name": "Victim's Customer",
  "totalUdhaar": 0,
  "totalJama": 0
}
```
2. **Ghost Field Injection**: Add `isAdmin: true` to a user profile.
3. **Negative Amount**: Add a transaction with `amount: -500`.
4. **Zero-Day ID Poisoning**: Use a 2KB string as a customer ID.
5. **Orphaned Transaction**: Create a transaction for a non-existent customer.
6. **Balance Manipulation**: Update a customer's `totalUdhaar` without an accompanying transaction.
7. **Cross-Shop Access**: List customers where `shopkeeperId` is not the current user.
8. **PII Leak**: Read another shopkeeper's user profile details.
9. **History Erasure**: Delete a transaction that is already part of a balance.
10. **Terminal State Bypass**: Reversing a "Settled" status incorrectly.
11. **Future Timestamp**: Set `createdAt` to 1 year in the future.
12. **Unauthorized Metadata Update**: Changing `shopkeeperId` on an existing customer.

## Test Runner Plan
We will use `@firebase/rules-unit-testing` (if available) to verify these. Since we are in a browser-based agent environment, we will focus on generating the `firestore.rules` that mathematically block these.
