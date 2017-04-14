const co = require('co');
const url = require('url');
const pify = require('pify');
const crypto = require('crypto');
const login = require('./lib/login');
const constants = require('./lib/constants');
const WXBizDataCrypt = require('./lib/WXBizDataCrypt');
const { Cookie, Store, MemoryStore } = require('express-session');

/**
 * 创建小程序会话中间件
 * @param {Object} [options]
 * @param {string} [options.appId] 小程序 appId
 * @param {string} [options.appSecret] 小程序 appSecret
 * @param {string} [options.loginPath] 小程序会话登录路径
 * @param {string} [options.maxAge] 会话有效期
 * @param {Object} [options.store=MemoryStore] 会话使用的 Store
 */
function session(options = {}) {
    const requireOption = key => {
        if (!options[key]) {
            throw new Error(`mp-session 初始化失败：${key} 没有配置`);
        }
        return options[key];
    }
    const appId = requireOption('appId');
    const appSecret = requireOption('appSecret');
    const loginPath = requireOption('loginPath');

    store = options.store || new MemoryStore();
    if (typeof store.set !== 'function' || typeof store.get !== 'function') {
        throw new Error('wafer-node-session 初始化失败：不是合法的 store');
    }

    const maxAge = options.maxAge || 24 * 3600 * 1000;

    return co.wrap(function* middleware(request, response, next) {

        // get session param from header or query
        // in case of non-express application
        const getParam = (() => {
            const headers = {};
            const queries = {};
            for (let key of Object.keys(request.headers)) {
                headers[key.toUpperCase()] = request.headers[key];
            }
            const query = url.parse(request.url).query || '';
            for (let pair of query.split('&')) {
                const [key, value] = pair.split('=');
                if (key) {
                    queries[key.toUpperCase()] = decodeURIComponent(value);
                }
            }
            return key => headers[key.toUpperCase()] || queries[key.toUpperCase()];
        })();

        const isLoginPath = url.parse(request.url).pathname == loginPath;
        const generateSkey = (sessionKey) => sha1(appId + appSecret + sessionKey);

        // session check
        const id = getParam(constants.WX_HEADER_ID);
        const skey = getParam(constants.WX_HEADER_SKEY);
        if (id && skey) {
            try {
                const session = yield pify(store.get.bind(store))(id);
                if (!session) {
                    throw new Error('会话过期');
                }
                
                if (skey != generateSkey(session.sessionKey)) {
                    throw new Error('skey 不正确');
                }
                request.sessionID = id;
                request.session = session;
                if (isLoginPath) {
                    response.json({
                        code: 0,
                        message: '小程序会话已登录'
                    });
                } else {
                    next();
                }
            } catch (err) {
                const errObj = {
                    [constants.WX_SESSION_MAGIC_ID]: 1,
                    error: constants.ERR_INVALID_SESSION,
                    message: '会话已失效，请重新登录：' + (err ? err.message : '未知错误')
                };
                if (response && response.json) {
                    response.json(errObj);
                } else {
                    request.sessionError = errObj;
                    next(request, response);
                }
            }
            return;
        }

        // login
        if (isLoginPath) {
            const requireHeader = (key) => {
                const header = getParam(key);
                if (!header) {
                    throw new login.LoginError(`请求头里没有找到 ${key}，小程序客户端请配合 wafer-node-sdk 使用，请参考：https://github.com/tencentyun/wafer-node-sdk`);
                }
                return header;
            };

            let code, encryptData, iv;
            try {
                code = requireHeader(constants.WX_HEADER_CODE);
                encryptData = requireHeader(constants.WX_HEADER_ENCRYPTED_DATA);
                iv = requireHeader(constants.WX_HEADER_IV);
            } catch (error) {
                const { type, message } = error;
                response.json({ type, message });
                response.end();
                return;
            }

            const { sessionKey, openId } = yield login({ appId, appSecret, code });

            const wxBiz = new WXBizDataCrypt(appId, sessionKey);
            const userInfo = wxBiz.decryptData(encryptData, iv);

            const session = request.session = {};
            session.id = request.sessionID = crypto.randomBytes(32).toString('hex');
            session.skey = generateSkey(sessionKey);
            session.sessionKey = sessionKey;
            session.userInfo = userInfo;
            session.cookie = new Cookie({ maxAge }); // fake cookie to support express-session Stores

            // save the session
            store.set(session.id, session, (err) => {
                if (err) {
                    console.error('store.set() error: ', err);
                }
                response.json({
                    [constants.WX_SESSION_MAGIC_ID]: 1,
                    session: {
                        id: session.id,
                        skey: session.skey
                    }
                });
                response.end();
            });
            return;
        }
        next();
    });
}

function sha1(message) {
    return crypto.createHash('sha1').update(message, 'utf8').digest('hex');
}

// expose express-session modules for store connectors
session.Cookie = Cookie;
session.Store = Store;
session.MemoryStore = MemoryStore;

module.exports = session;