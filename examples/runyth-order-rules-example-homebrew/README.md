# Runyth Order: Rules Example Homebrew

This directory is a complete minimal complementary-module example. It demonstrates:

- a required relationship on Runyth Order;
- strict provider registration during `init`;
- D&D 5e version declaration;
- standard and custom capabilities;
- a structured content-pack descriptor;
- a non-mutating Actor validator;
- an idempotent explicit migration;
- provider-owned metadata and documentation links.

The example intentionally does not ship actual playable rules or a compiled compendium. Production content modules should put canonical game-system documents in module compendia and reference stable UUIDs from `entries`.

## Try it locally

1. Copy this directory to `Data/modules/runyth-order-rules-example-homebrew/`.
2. Install and enable Runyth Order.
3. Use a D&D 5e 5.3.3 test world.
4. Enable the example module.
5. Open Rules Hub and inspect the provider, pack, capabilities, validator, migration, and diagnostics.

Do not publish the example as gameplay content. Copy it into a new repository, rename every stable ID, remove the demonstration migration, add real compendia, and implement provider-specific tests.

## Licence
Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
