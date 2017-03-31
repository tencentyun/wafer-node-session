微信小程序 Node 会话管理中间件
============================

`wafer-node-session` 处理来自小程序的登录请求并建立和维护会话。

## 获取与安装

```
npm install wafer-node-session --save
```

## 使用

```js
const express = require('express');
const session = require('wafer-node-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
    // 小程序 appId
    appId: '...',

    // 小程序 appSecret
    appSecret: '...',

    // 登录地址
    loginPath: '/login',

    // 会话存储
    store: new RedisStore({ ... })
}));

app.use('/me', function(request, response, next) {
    if (request.session) {
        // 从会话获取用户信息
        response.json(request.session.userInfo);
    } else {
        response.json({ nobody: true });
    }
})
```

上面的会话存储使用了 [connect-redis](https://github.com/tj/connect-redis)，实际上，`wafer-node-session` 支持 `express-session` 的 Store，具体可参考[这个列表](https://github.com/expressjs/session#compatible-session-stores)。