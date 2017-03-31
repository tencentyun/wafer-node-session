const url = require('url');
const co = require('co');
const pify = require('pify');
const request = require('request');
const constants = require('./constants');

module.exports = co.wrap(function* login({ appId, appSecret, code }) {
    const exchangeUrl = buildExchangeUrl(appId, appSecret, code);
    const [response, body] = yield pify(request.get, { multiArgs: true })({ url: exchangeUrl, json: true });

    if (body && 'session_key' in body) {
        return {
            sessionKey: body.session_key,
            openId: body.openid
        };
    }

    throw new LoginError('jscode failed to exchange for session_key', body);
});

module.exports.LoginError = class LoginError extends Error {
    constructor(message, detail) {
        super(`登录小程序会话失败：${message}`);
        this.type = constants.ERR_LOGIN_FAILED;
        this.detail = detail;
    }
}

function buildExchangeUrl(appid, secret, js_code) {
    return url.format({
        protocol: 'https:',
        host: 'api.weixin.qq.com',
        pathname: '/sns/jscode2session',
        query: {
            appid,
            secret,
            js_code,
            grant_type: 'authorization_code'
        }
    });
}