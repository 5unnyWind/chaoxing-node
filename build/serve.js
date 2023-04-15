"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main_handler = exports.handler = exports.main = void 0;
const router_1 = __importDefault(require("@koa/router"));
const child_process_1 = require("child_process");
const koa_1 = __importDefault(require("koa"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const multiparty_1 = __importDefault(require("multiparty"));
const serverless_http_1 = __importDefault(require("serverless-http"));
const activity_1 = require("./functions/activity");
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const photo_1 = require("./functions/photo");
const qrcode_1 = require("./functions/qrcode");
const tencent_qrcode_1 = require("./functions/tencent.qrcode");
const user_1 = require("./functions/user");
const file_1 = require("./utils/file");
// const ENVJSON = (0, file_1.getJsonObject)('env.json')||null;
const app = new koa_1.default();
const router = new router_1.default();
const processMap = new Map();
router.get('/', async (ctx) => {
    ctx.body = '<h1 style="text-align: center">Welcome, chaoxing-sign-cli API service is running.</h1>';
});
router.post('/login', async (ctx) => {
    const { phone, password } = ctx.request.body;
    const params = await (0, user_1.userLogin)(phone, password);
    if (typeof params === 'string') {
        ctx.body = params;
        return;
    }
    params.name = (await (0, user_1.getAccountInfo)(params)) || '获取失败';
    console.log(ctx.request.body);
    ctx.body = params;
});
router.post('/activity', async (ctx) => {
    const { uid, _d, vc3, uf } = ctx.request.body;
    const courses = await (0, user_1.getCourses)(uid, _d, vc3);
    if (typeof courses === 'string') {
        ctx.body = courses;
        return;
    }
    const activity = await (0, activity_1.traverseCourseActivity)({
        courses,
        uf: uf,
        _d: _d,
        _uid: uid,
        vc3: vc3,
    });
    if (typeof activity === 'string') {
        ctx.body = activity;
        return;
    }
    await (0, activity_1.preSign)({
        uf,
        _d,
        vc3,
        _uid: uid,
        ...activity,
    });
    console.log(uid);
    ctx.body = activity;
});
router.post('/qrcode', async (ctx) => {
    const { name, fid, uid, activeId, uf, _d, vc3, enc } = ctx.request.body;
    const res = await (0, qrcode_1.QRCodeSign)({
        enc,
        name,
        fid,
        _uid: uid,
        activeId,
        uf,
        _d,
        vc3,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/location', async (ctx) => {
    const { uf, _d, vc3, name, uid, lat, lon, fid, address, activeId } = ctx.request.body;
    const res = await (0, location_1.LocationSign)({
        uf,
        _d,
        vc3,
        name,
        address,
        activeId,
        _uid: uid,
        lat,
        lon,
        fid,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/general', async (ctx) => {
    const { uf, _d, vc3, name, activeId, uid, fid } = ctx.request.body;
    const res = await (0, general_1.GeneralSign)({
        uf,
        _d,
        vc3,
        name,
        activeId,
        _uid: uid,
        fid,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/uvtoken', async (ctx) => {
    const { uf, _d, uid, vc3 } = ctx.request.body;
    const res = await (0, user_1.getPanToken)({
        uf,
        _d,
        _uid: uid,
        vc3,
    });
    ctx.body = JSON.parse(res);
});
router.post('/upload', async (ctx) => {
    const form = new multiparty_1.default.Form();
    const fields = {};
    const data = [];
    const result = await new Promise((resolve) => {
        form.on('part', (part) => {
            if (part.filename !== undefined) {
                part.on('data', (chunk) => {
                    data.push(chunk);
                });
                part.on('close', () => {
                    part.resume();
                });
            }
        });
        form.on('field', (name, str) => {
            fields[name] = str;
        });
        form.on('close', async () => {
            const buffer = Buffer.concat(data);
            const res = await (0, photo_1.uploadPhoto)({
                uf: fields['uf'],
                _d: fields['_d'],
                _uid: fields['_uid'],
                vc3: fields['vc3'],
                token: ctx.query._token,
                buffer,
            });
            resolve(res);
        });
        form.parse(ctx.req);
    });
    ctx.body = result;
});
router.post('/photo', async (ctx) => {
    const { uf, _d, uid, vc3, name, activeId, fid, objectId } = ctx.request.body;
    const res = await (0, photo_1.PhotoSign)({
        uf,
        _d,
        vc3,
        name,
        activeId,
        _uid: uid,
        fid,
        objectId,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/qrocr', async (ctx) => {
    const form = new multiparty_1.default.Form();
    const data = [];
    const result = await new Promise((resolve) => {
        form.on('part', (part) => {
            if (part.filename !== undefined) {
                part.on('data', (chunk) => {
                    data.push(chunk);
                });
                part.on('close', () => {
                    part.resume();
                });
            }
        });
        form.on('close', async () => {
            const buffer = Buffer.concat(data);
            const base64str = buffer.toString('base64');
            let res;
            try {
                res = await (0, tencent_qrcode_1.QrCodeScan)(base64str, 'base64');
                const url = res.CodeResults[0].Url;
                const enc_start = url.indexOf('enc=') + 4;
                const result = url.substring(enc_start, url.indexOf('&', enc_start));
                resolve(result);
            }
            catch (error) {
                resolve('识别失败');
            }
        });
        form.parse(ctx.req);
    });
    ctx.body = result;
});
router.get('/monitor/status/:phone', (ctx) => {
    if (processMap.get(ctx.params.phone)) {
        ctx.body = { code: 200, msg: 'Monitoring' };
    }
    else {
        ctx.body = { code: 201, msg: 'Suspended' };
    }
});
router.post('/monitor/stop/:phone', (ctx) => {
    const phone = ctx.params.phone;
    const process_monitor = processMap.get(phone);
    if (process_monitor !== undefined) {
        process_monitor.kill('SIGKILL');
        processMap.delete(phone);
    }
    ctx.body = { code: 201, msg: 'Suspended' };
});
router.post('/monitor/start/:phone', async (ctx) => {
    if (processMap.get(ctx.params.phone) !== undefined) {
        ctx.body = { code: 200, msg: 'Already started' };
        return;
    }
    const process_monitor = (0, child_process_1.fork)(process.argv[1].endsWith('ts') ? 'monitor.ts' : 'monitor.js', ['--auth', ctx.params.phone, ctx.request.rawBody], {
        cwd: __dirname,
        detached: false,
        stdio: [null, null, null, 'ipc'],
    });
    const response = await new Promise((resolve) => {
        process_monitor.on('message', (msg) => {
            switch (msg) {
                case 'success': {
                    processMap.set(ctx.params.phone, process_monitor);
                    resolve({ code: 200, msg: 'Started Successfully' });
                    break;
                }
                case 'authfail': {
                    resolve({ code: 202, msg: 'Authencation Failed' });
                    break;
                }
                case 'notconfigured': {
                    resolve({ code: 203, msg: 'Not Configured' });
                    break;
                }
            }
        });
    });
    ctx.body = response;
});
app.use((0, koa_bodyparser_1.default)({ enableTypes: ['json', 'form', 'text'] }));
app.use(async (ctx, next) => {
    await next();
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    if (ctx.method === 'OPTIONS') {
        ctx.set('Access-Control-Max-Age', '300');
        ctx.body = '';
    }
});
app.use(router.routes());
process.on('exit', () => {
    processMap.forEach((pcs) => {
        pcs.kill('SIGKILL');
    });
});
// if (!ENVJSON.env.SERVERLESS)
//     app.listen(5001, () => {
//         console.log('API Server: http://localhost:5001');
//     });
exports.main = (0, serverless_http_1.default)(app);
exports.handler = exports.main;
exports.main_handler = exports.main;

module.exports = app.callback();
