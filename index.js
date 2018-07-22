/*
 * Koa middleware to handle requests to a configured Amazon Alexa skill.
 * 
 * The Alexa request is validated as described in the Amazon Alexa "Host a Custom Skill as a Web Service document 
 * (https://developer.amazon.com/docs/custom-skills/host-a-custom-skill-as-a-web-service.html#verifying-that-the-request-was-sent-by-alexa)
 * before being passed to a custom ASK Skill implementation.
 */
const debug = require('debug')('koa:application');
let Alexa = require('ask-sdk-core');
let verifier = require('alexa-verifier');

/**
 * Generates a Koa middleware handler function to process an Amazon Alexa skill request.
 * @param {Object} options Options to be applied to the request handler
 * @param {Object} options.skill Amazon Alexa skill implementation (instance of an ask-sdk-core.Skill)
 * @param {boolean=true} options.validate If a falsey value forces request validation to be skipped (for development purposes only!)
 * @returns {Function} A Koa middleware function to handle the Amazon Alexa request
 * @throws {TypeError} If the specified options are invalid
 * @throws {Error} If the request fails to be successfully processed
 */
function generateAlexaRequestHandler(options={}) {
    /* Validate the options */
    let skill = options.skill;
    let validate = !(options.validate===false);
    if (skill==undefined || (typeof skill!='object') || !(skill instanceof Alexa.Skill)) {
        throw new TypeError(`Option skill is not an Alexa SDK skill`);
    }

    /* Return the middleware function to handle the Alexa skill request */
    return async function handleRequest(ctx) {
        //Validate the client request
        ctx.assert(ctx.accepts('json'), 406);
        ctx.assert(ctx.method==='POST', 405);
        if (validate) {
            ctx.assert(ctx.header.signaturecertchainurl!=undefined, 400, 'Signature certificate chaing URL missing');
            ctx.assert(ctx.header.signature!=undefined, 400, 'Signature missing');
            ctx.assert(ctx.request.body!=undefined, 400);
            try {
                await verifier(ctx.header.signaturecertchainurl, ctx.header.signature, JSON.stringify(ctx.request.body));
            } catch (err) {
                debug(`${err.name||'Error'} verifying Alexa certificate for skill: ${err.message || JSON.stringify(err)}`);
                ctx.assert(false, 400, 'Invalid signature');
            }
        }

        /* Handle the validated request and return the response */
        let event = ctx.request.body;
        let context = {};
        console.log(`Handling validated skill request: ${JSON.stringify({headers: ctx.header, event: event, context: context})}`);
        try {
            //Call the skill and return the response
            let skillResponse = await skill.invoke(event, context)
            console.log(`Returing response to skill: ${JSON.stringify(skillResponse)}`);
            ctx.response.status = 200; ctx.response.type = 'text/json';
            ctx.response.body = skillResponse;
        } catch(err) {
            //Format and return the error
            console.log(`${err.name||'Error'} handling skill: ${err.message || JSON.stringify(err)}`);
            ctx.response.status = 500; ctx.response.type = 'text/json'
            ctx.response.body = err.message;
        };
    }
}


module.exports = generateAlexaRequestHandler;
