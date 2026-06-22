# [2.0.0](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.0.3...v2.0.0) (2026-06-18)


### Bug Fixes

* **ci:** resolve onboarding lint parse and prefer-const errors ([06b69ca](https://github.com/Estehsan/backstage-plugin-onboarding/commit/06b69ca2bea8d47c7ad5cbf63471a644cc458e47))
* **onboarding:** improve user search and update lockfile ([e053d21](https://github.com/Estehsan/backstage-plugin-onboarding/commit/e053d218de68a35566cad7ac5506a6b8040b9e7b))
* **onboarding:** resolve dual React hoisting by pinning react resolutions ([7286f39](https://github.com/Estehsan/backstage-plugin-onboarding/commit/7286f395fa5febc86ad1cca9661e69fcd76727b4))


### Features

* **onboarding:** extract catalog module + improve documentation ([cc5e7db](https://github.com/Estehsan/backstage-plugin-onboarding/commit/cc5e7dbfa1e4a685af3a36e9c57285542945fba6))


### BREAKING CHANGES

* **onboarding:** The catalog module is no longer exported from
@estehsaan/backstage-plugin-onboarding-backend/alpha. Install
@estehsaan/backstage-plugin-catalog-backend-module-onboarding instead.

Signed-off-by: Estehsan <estehsaan@gmail.com>

## [1.0.3](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.0.2...v1.0.3) (2026-04-23)


### Bug Fixes

* **lockfile:** sync yarn.lock with updated common package version ([14af40b](https://github.com/Estehsan/backstage-plugin-onboarding/commit/14af40bb62a4611db10e6459b170addf6d68d4c1))
* **onboarding:** correct alpha exports paths in publishConfig ([7147763](https://github.com/Estehsan/backstage-plugin-onboarding/commit/7147763600f175539140a6bf3369744ff7b709e4))

## [1.0.2](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.0.1...v1.0.2) (2026-04-07)


### Bug Fixes

* pre-merge review — validation, caching, timeouts, docs ([0cdbabf](https://github.com/Estehsan/backstage-plugin-onboarding/commit/0cdbabfddfc35bef828351826d1a2311af9496ff))

## [1.0.1](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.0.0...v1.0.1) (2026-04-04)


### Bug Fixes

* export legacy OnboardingPage and document new/legacy usage ([9f14c20](https://github.com/Estehsan/backstage-plugin-onboarding/commit/9f14c20b9febb93d1ceab48029bf43863555d404))
* wrap OnboardingPage as typed function component to avoid ae-forgotten-export API warning ([1e17ce3](https://github.com/Estehsan/backstage-plugin-onboarding/commit/1e17ce38d162c55e94afc9dde3a604377a99e13d))

# 1.0.0 (2026-04-04)


### Bug Fixes

* trigger initial semantic-release publish ([22e084d](https://github.com/Estehsan/backstage-plugin-onboarding/commit/22e084da805e88f0463ad8ac1d53e68961468974))
