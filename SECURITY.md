# Security policy

Report security-sensitive defects privately through the security-advisory feature of the Runyth repository when available. Do not include campaign data, world exports, access tokens, private module source, or player information in a public issue.

## Supported release

The newest `1.x` release receives security fixes. Compatibility is limited to the Foundry versions declared in `module.json`.

## Trust boundary

Runyth Order validates descriptors and coordinates code supplied by active complementary modules. Foundry modules execute with the permissions available to the logged-in client. Installing a complementary module therefore means trusting its code independently of this core.

The core deliberately does not:

- load executable code from provider URLs;
- evaluate provider strings as JavaScript;
- accept player-authoritative migration requests;
- run provider migrations automatically;
- treat hidden client-side data as a security boundary;
- store credentials or real-world secrets.
