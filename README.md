# koa-alexa
Koa middleware to handle Amazon Alexa requests to a defined skill.


## Installation
Install the koa-alexa package from NPM:
```bash
npm install --save koa-alexa
```


## Usage
To use the middleware, add it to a Koa server as follows:

```js
const Koa = require('koa');
const KoaBody = require('koa-body');
const KoaAlexa = require('koa-alexa');
let skill = require('./skill'); //Instance of an Alexa.Skill

const app = new Koa();

app.use(KoaBody({ jsonLimit: '10kb'} ));

app.use(KoaAlexa({ skill: skill, validate: true }));

app.listen(3000);
```


The `skill` must be an instance of an Skill class from the Amazon `ask-sdk-core` package.
