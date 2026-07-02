# [1.3.0](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.2.0...v1.3.0) (2026-07-02)


### Bug Fixes

* **onboarding-backend:** enforce assignerGroups on sensitive routes and resolve buddy display names ([96a515e](https://github.com/Estehsan/backstage-plugin-onboarding/commit/96a515ec428528dd90ac017e482684772593c114))
* **onboarding:** correct buddy-assignment test selection and dialog query ([22acc2e](https://github.com/Estehsan/backstage-plugin-onboarding/commit/22acc2ea88e946b8a83f8962ddd20a56cc700045))
* **onboarding:** eliminate stale-state flash in buddy assignment dialog ([e2ee5e2](https://github.com/Estehsan/backstage-plugin-onboarding/commit/e2ee5e27dad36d8254b14bb0888cd8893882f468))
* **onboarding:** log permission-check failures for observability ([22da98c](https://github.com/Estehsan/backstage-plugin-onboarding/commit/22da98c76902555b1573c744cf8194303c9ad3e0))
* **onboarding:** stabilize frontend test environment and suites ([046a0d5](https://github.com/Estehsan/backstage-plugin-onboarding/commit/046a0d5b66d6de114de4685bcfe00cc18d867602))
* **onboarding:** wrap resource Tag elements in TagGroup ([d73b9ac](https://github.com/Estehsan/backstage-plugin-onboarding/commit/d73b9ac8f5f150e12e195d4d5169b97d879d0bd9))


### Features

* **onboarding-backend:** add assignerGroups config schema ([b500296](https://github.com/Estehsan/backstage-plugin-onboarding/commit/b500296bc798474ac288fc5f3810ef3b95353903))
* **onboarding-backend:** add buddy_user_id migration ([aed6f7d](https://github.com/Estehsan/backstage-plugin-onboarding/commit/aed6f7da35a4b55d5fdaac8ff9168f00d0484ecf))
* **onboarding-backend:** add buddy_user_id to OnboardingProgressRow ([f47d97d](https://github.com/Estehsan/backstage-plugin-onboarding/commit/f47d97dbfa5b758fa3b79a28774ccbb2d56fb5a3))
* **onboarding-backend:** add buddy, teams/mine, assigner/me, buddies/mine routes ([6737513](https://github.com/Estehsan/backstage-plugin-onboarding/commit/6737513acacf3a4e16282d92eec9ca3b7594d737))
* **onboarding-backend:** add setBuddy/getBuddyProgress to OnboardingStore ([29055cc](https://github.com/Estehsan/backstage-plugin-onboarding/commit/29055ccd0c5a87fa384c70f367b8410e27bb48c3))
* **onboarding-common:** add buddyUserId and TeamJoinerSummary types ([a6608f9](https://github.com/Estehsan/backstage-plugin-onboarding/commit/a6608f9eb6d9f46fe1d3b9505097fd958c925f27))
* **onboarding:** add buddy/teams/assigner API client methods ([9b760f4](https://github.com/Estehsan/backstage-plugin-onboarding/commit/9b760f41b2838be61b978ca5007fd5537c4d0bdd))
* **onboarding:** add lead/buddy dual-mode Team View with team selector ([d96a0ce](https://github.com/Estehsan/backstage-plugin-onboarding/commit/d96a0cedce7568950517b0aa5cf882a7d516016c))
* **onboarding:** redesign templates cards and add buddy picker ([1f84876](https://github.com/Estehsan/backstage-plugin-onboarding/commit/1f848768eaa1f22bd6d18f9cbc42855211a20fd4))
* **onboarding:** scope Templates/Team View tabs to assigners and buddies ([ca392ab](https://github.com/Estehsan/backstage-plugin-onboarding/commit/ca392ab0f1ebfef9d1b15d1d213952a50b79d802))

# [1.2.0](https://github.com/Estehsan/backstage-plugin-onboarding/compare/v1.1.0...v1.2.0) (2026-06-30)


### Bug Fixes

* **backend:** secure progress routes and make user search reliable ([158c2ff](https://github.com/Estehsan/backstage-plugin-onboarding/commit/158c2ff5f5b54bb4a52037c5783afcecc7a34e09))
* **examples:** use onboarding.backstage.io/v1 apiVersion for templates ([775ac93](https://github.com/Estehsan/backstage-plugin-onboarding/commit/775ac93f80d634d1a20aeb0ccf193740a0356277))
* **frontend:** harden API client, polling, and assign search UX ([509b8eb](https://github.com/Estehsan/backstage-plugin-onboarding/commit/509b8eb79b99fac14fa3dbaa02aa155ca37f9bad))
* **onboarding:** fix prettier formatting and BUI Box mt type after migration ([107f577](https://github.com/Estehsan/backstage-plugin-onboarding/commit/107f577c2a8e944f21e46e85e256ebdaca2eb7b9))
* **onboarding:** remove @backstage/ui CSS import from plugin entry (app-level concern) ([c45ea3f](https://github.com/Estehsan/backstage-plugin-onboarding/commit/c45ea3fc81b9692ffa1c155c2fe7a186c5b0bf25))
* **onboarding:** resolve dual React hoisting and syntax error ([c206f36](https://github.com/Estehsan/backstage-plugin-onboarding/commit/c206f369b1b8d8f0d10a5c3c5df0f486e3f80799))
* **onboarding:** satisfy ConsumedResponse type in OnboardingClient ([a8f32a1](https://github.com/Estehsan/backstage-plugin-onboarding/commit/a8f32a17598f6e773316c75d9d0b1a96ae1fde21))


### Features

* **catalog-module:** validate OnboardingTemplate spec structure ([a445159](https://github.com/Estehsan/backstage-plugin-onboarding/commit/a445159cb85ce5e2b07efbe2736186799dc53e83))
* **onboarding:** add @backstage/ui and @remixicon/react deps, import BUI styles ([b141db1](https://github.com/Estehsan/backstage-plugin-onboarding/commit/b141db1bb1a4b7b1fdddd0a4ed4eee2bedb92a07))
* **onboarding:** migrate EntityUserOnboardingCard to BUI (Text, Tag), keep core-components ([2e3e119](https://github.com/Estehsan/backstage-plugin-onboarding/commit/2e3e11916ae547a79ef72863d0c0e5d47072d958))
* **onboarding:** migrate OnboardingPage tabs to BUI (Tabs/TabList/TabPanel/Tab) ([5b1e603](https://github.com/Estehsan/backstage-plugin-onboarding/commit/5b1e603aa27f35ae2c87bb102f43b70bcd534335))
* **onboarding:** migrate ProgressBar to BUI Text + CSS module with design tokens ([c67d6c0](https://github.com/Estehsan/backstage-plugin-onboarding/commit/c67d6c0bca654bd388d37e4ab0e2916b3771f778))
* **onboarding:** migrate TaskDetailPanel to BUI (Text, Tag, Remix icons), keep Collapse MUI ([25c1924](https://github.com/Estehsan/backstage-plugin-onboarding/commit/25c1924c821db39d4daaa37eb6ee0d5ee952724b))
* **onboarding:** migrate TaskItem to BUI (ButtonIcon, TooltipTrigger, Text, Tag, Remix icons) ([2f3edaa](https://github.com/Estehsan/backstage-plugin-onboarding/commit/2f3edaa92b312317da3ae369504b18df7d2731f4))
* **onboarding:** migrate TaskList to BUI (Text, Card, Tag, Flex) + CSS module ([1353fc0](https://github.com/Estehsan/backstage-plugin-onboarding/commit/1353fc00220eabd5bbb5e833e405e6fc8ba5ce46))
* **onboarding:** migrate TeamView to BUI (Text, TagGroup, ButtonIcon, Remix icons) ([781d7a1](https://github.com/Estehsan/backstage-plugin-onboarding/commit/781d7a1bb22c18021c7605fb837816bea9a20ee4))
* **onboarding:** migrate TemplatesView to BUI (Text, TagGroup, Card/CardBody) ([04c3084](https://github.com/Estehsan/backstage-plugin-onboarding/commit/04c30848fb085fdb6347c41a73a425844c797060))

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
