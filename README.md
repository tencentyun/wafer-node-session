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

## 客户端配合

小程序需要使用 [wafer-client-sdk](https://github.com/tencentyun/wafer-client-sdk) 发起请求才能正常建立会话，请在客户端进行引入。

```
npm install -g bower
bower install wafer-client-sdk
```

客户端发起请求代码如下：

```js
var wafer = require('./bower_components/wafer-client-sdk/index');
var HOST = 'my.example.com';

// 登录地址，注意路径要和中间件配置的 loginPath 一直
wafer.setLoginUrl(`https://${HOST}/login`);
wafer.request({
    login: true,
    url: `https://${HOST}/user`,
    success: function(response) {
        console.log(response);
    },
    fail: function(err) {
        console.log(err);
    }
});
```