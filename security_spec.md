# Security Specification: Camp Market Revenue System

## Data Invariants
- A Payment must involve a valid Vendor ID.
- Total Paid for a Vendor cannot exceed Total Due (validation in app, rule checks amount).
- Only Admins can modify Category prices.
- Staff can create Payment documents but not modify or delete them (immutable records).
- Vendors can only be created by Admins.

## The "Dirty Dozen" Payloads (Denial Expected)
1. **Unauthorized Write**: Unauthenticated user trying to create a category.
2. **Staff Elevating Price**: Staff user trying to change a category price.
3. **Staff Deleting Payment**: Staff user trying to delete a payment record.
4. **Vendor Spoofing**: User trying to create a payment with a different `collectedBy` UID than their own.
5. **Admin Lockdown**: Trying to delete the 'admins' collection entry (protected by being a top-level collection Staff can't touch).
6. **Massive ID**: Document ID with 1MB string.
7. **Invalid Amount**: Negative payment amount.
8. **Stat Modification**: Staff trying to manually reset a Vendor's `totalPaid` without a corresponding Payment document (atomic write required).
9. **Role Escalation**: Staff user trying to update their own `role` to 'admin' in the `/users/` collection.
10. **Orphaned Payment**: Creating a payment for a `vendorId` that doesn't exist.
11. **Immutation Bypass**: Trying to change the `vendorId` of an existing Payment document.
12. **Future Payment**: Setting a payment date in the future (though `request.time` is better).

## Test Runner (Draft Logic)
- Verify `allow create: if request.auth.uid == incoming().collectedBy`.
- Verify `allow update: if isAdmin()`.
- Verify `allow delete: if isAdmin()`.
