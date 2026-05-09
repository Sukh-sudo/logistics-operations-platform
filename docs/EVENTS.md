# Domain Events

## Package Events

- PACKAGE_RECEIVED
- PACKAGE_SORTED
- PACKAGE_STAGED
- PACKAGE_LOADED
- PACKAGE_UNLOADED
- PACKAGE_DELIVERED
- PACKAGE_HELD
- PACKAGE_DAMAGED
- PACKAGE_WEIGHED

## Trailer Events

- TRAILER_ARRIVED
- TRAILER_DOCKED
- TRAILER_LOADING
- TRAILER_UNLOADING
- TRAILER_SEALED
- TRAILER_DEPARTED

## Employee Events

- EMPLOYEE_LOGIN
- EMPLOYEE_LOGOUT
- EMPLOYEE_TRANSFERRED

## Event Rules

Events must:
- represent business occurrences
- remain immutable
- include timestamps
- include employee context
- support analytics
- support auditability