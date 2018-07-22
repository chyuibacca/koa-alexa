const assert = require('chai').assert;
const rewire = require('rewire');
const middleware = rewire('../index.js');
const Alexa = require('ask-sdk-core');


describe('Tests for /index.js', () => {
    /* Set up test: create a mock skill */
    let skill;
    before(() => {
        const TestHandler = {
            canHandle(handlerInput) { return true; },
            async handle(handlerInput) {
                return handlerInput.responseBuilder.speak(`Success`).getResponse();
            }
        };
        const skillBuilder = Alexa.SkillBuilders.custom().addRequestHandlers(TestHandler);
        skill = new Alexa.Skill(skillBuilder.getSkillConfiguration());
    });

    /* Test initialisation */
    describe('Test initialisation', () => {
        it('Initialisation with valid options should return a function', async () => {
            let result = middleware({ skill: skill, validate: true });
            assert.isDefined(result, 'Should return a defined value');
            assert.isFunction(result, 'Should return a function');
        });
        it('Initialisation with invalid skill', async () => {
            function initWithInvalidSkill() {
                middleware({ skill: {}, validate: true });
            }
            assert.throws(initWithInvalidSkill, TypeError, /not an Alexa SDK skill/, 'Should throw a TypeError');
        });
        it('Initialisation with undefined skill', async () => {
            function initWithUndefinedSkill() {
                middleware({ validate: true });
            }
            assert.throws(initWithUndefinedSkill, TypeError, /not an Alexa SDK skill/, 'Should throw a TypeError');
        });
    });

    /* Test handling */
    describe('Test request handling', () => {
        it('Request does not accept JSON', async () => {
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => { return false; },
                assert: require('http-assert')
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.equal(err.status, 406, 'Request should throw a 406');
            }
            assert.isUndefined(results, 'Request should throw an error');
        });
        it('Request is not a POST', async () => {
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => { return true; },
                assert: require('http-assert'),
                method: 'GET'
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.equal(err.status, 405, 'Request should throw a 405');
            }
            assert.isUndefined(results, 'Request should throw an error');
        });
        it('Request does not contain a signaturecertchainurl header', async () => {
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => { return true; },
                assert: require('http-assert'),
                method: 'POST',
                header: {}
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.equal(err.status, 400, 'Request should throw a 400');
                assert.equal(err.message, 'Signature certificate chaing URL missing',
                    'Request should throw an error with an missing signature chain URL message');
            }
            assert.isUndefined(results, 'Request should throw an error');
        });
        it('Request does not contain a signature header', async () => {
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => { return true; },
                assert: require('http-assert'),
                method: 'POST',
                header: {
                    signaturecertchainurl: 'https://signaturecertchainurl.com'
                }
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.equal(err.status, 400, 'Request should throw a 400');
                assert.equal(err.message, 'Signature missing', 'Request should throw an error with an missing signature message');
            }
            assert.isUndefined(results, 'Request should throw an error');
        });
        it('Request fails verification', async () => {
            middleware.__set__('verifier', ()=>{ return Promise.reject(new Error('Test verification error')); });
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => { return true; },
                assert: require('http-assert'),
                method: 'POST',
                header: {
                    signaturecertchainurl: 'https://signaturecertchainurl.com',
                    signature: 'somesignature'
                },
                request: { body: { } },
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.equal(err.status, 400, 'Request should throw a 400');
                assert.equal(err.message, 'Invalid signature', 'Request should throw an error with an invalid signature message');
            }
            assert.isUndefined(results, 'Request should throw an error');
        });
        it('Request is a valid intent request', async () => {
            middleware.__set__('verifier', ()=>{ return true; });
            let handler = middleware({ skill: skill, validate: true });
            let ctx = {
                accepts: (...args) => {
                    return true;
                },
                method: 'POST',
                assert: require('http-assert'),
                header: {
                    signaturecertchainurl: 'https://somesignaturecertchainurl.com',
                    signature: 'somesignature'
                },
                request: { body: {} },
                response: {}
            };
            try {
                let results = await handler(ctx);
            } catch (err) {
                assert.isUndefined(err, `Handler should not throw a ${err.name||'error'}`);
            }
            assert.isDefined(ctx.response, 'A valid response should be set in the context');
            assert.deepEqual(ctx.response.status, 200, 'Response status HTTP_OK');
            assert.deepEqual(ctx.response.type, 'text/json', 'Response type should be JSON');
            assert.isDefined(ctx.response.body, 'Response body should be a defined value');
            assert.isDefined(ctx.response.body.response, 'Response body should contain a defined response value');
            assert.isDefined(ctx.response.body.response.outputSpeech, 'Response body should contain a defined outputSpeech value');
            assert.deepEqual(ctx.response.body.response.outputSpeech, {type: "SSML", ssml: "<speak>Success</speak>"},
                'Response outputSpeech is invalid');
        });
        it('Request is a valid intent request but skill throws an error', async () => {
            const TestErrorHandler = {
                canHandle(handlerInput) { return true; },
                async handle(handlerInput) {
                    throw new Error('Test skill error');
                }
            };
            const skillBuilder = Alexa.SkillBuilders.custom().addRequestHandlers(TestErrorHandler);
            let errorSkill = new Alexa.Skill(skillBuilder.getSkillConfiguration());
            let handler = middleware({ skill: errorSkill, validate: false });
            let ctx = {
                accepts: (...args) => {
                    return true;
                },
                method: 'POST',
                assert: require('http-assert'),
                header: { },
                request: { body: {} },
                response: {}
            };
            let results = undefined;
            try {
                results = await handler(ctx);
            } catch (err) {
                assert.isUndefined(err, `Handler should not throw a ${err.name||'error'}`);
            }
            assert.isDefined(ctx.response, 'A valid response should be set in the context');
            assert.deepEqual(ctx.response.status, 500, 'Response status HTTP_INTERNAL_SERVER_ERROR');
            assert.deepEqual(ctx.response.type, 'text/json', 'Response type should be JSON');
            assert.isDefined(ctx.response.body, 'Response body should be a defined value');
            assert.equal(ctx.response.body, 'Test skill error', 'Response body should contain a defined error message value');
        });
    });
});
