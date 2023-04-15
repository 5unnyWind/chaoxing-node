import prompts from 'prompts';
import { blue, red } from 'kolorist';
import { getPPTActiveInfo, preSign, traverseCourseActivity } from './functions/activity';
import { GeneralSign } from './functions/general';
import { LocationSign } from './functions/location';
import { getObjectIdFromcxPan, PhotoSign } from './functions/photo';
import { QRCodeSign } from './functions/qrcode';
import { getAccountInfo, getCourses, getLocalUsers, userLogin } from './functions/user';
import { getJsonObject, storeUser } from './utils/file';

const PromptsOptions = {
  onCancel: () => {
    console.log(red('✖') + ' 操作取消');
    process.exit(0);
  },
};

(async function () {
  let params: UserCookieType & { phone?: string; };
  const configs: any = {};
  // 本地与登录之间的抉择
  {
    // 打印本地用户列表，并返回用户数量
    const { userItem } = await prompts({
      type: 'select',
      name: 'userItem',
      message: '选择用户',
      choices: getLocalUsers(),
      initial: 0,
    }, PromptsOptions);
    // 使用新用户登录
    if (userItem === -1) {
      const { phone } = await prompts({ type: 'text', name: 'phone', message: '手机号' }, PromptsOptions);
      const { password } = await prompts({ type: 'password', name: 'password', message: '密码' }, PromptsOptions);
      // 登录获取各参数
      const result = await userLogin(phone, password);
      if (typeof result === 'string') process.exit(0);
      else storeUser(phone, { phone, params: result }); // 储存到本地
      params = { ...result, phone };
    } else {
      // 使用本地储存的参数
      const jsonObject = getJsonObject('configs/storage.json').users[userItem];
      params = { ...jsonObject.params };
      params.phone = jsonObject.phone;
      configs.monitor = { ...jsonObject.monitor };
      configs.mailing = { ...jsonObject.mailing };
      configs.cqserver = { ...jsonObject.cqserver };
    }
    if (typeof params === 'string') return;
  }

  // 获取用户名
  const name = await getAccountInfo(params);
  console.log(blue(`你好，${name}`));

  // 获取所有课程
  const courses = await getCourses(params._uid, params._d, params.vc3);
  if (typeof courses === 'string') process.exit(0);
  // 获取进行中的签到活动
  const activity = await traverseCourseActivity({ courses, ...params });
  if (typeof activity === 'string') process.exit(0);
  else await preSign({ ...activity, ...params });

  // 处理签到，先进行预签
  switch (activity.otherId) {
    case 2: {
      // 二维码签到
      const { enc } = await prompts({ type: 'text', name: 'enc', message: 'enc(微信或其他识别二维码，可得enc参数)' }, PromptsOptions);
      await QRCodeSign({ ...params, activeId: activity.activeId, enc, name });
      break;
    }
    case 4: {
      // 位置签到
      console.log('[获取经纬度]https://api.map.baidu.com/lbsapi/getpoint/index.html');
      const defaultLngLat = configs.monitor ? `${configs.monitor.lon},${configs.monitor.lat}` : '113.516288,34.817038';
      const defaultAddress = configs.monitor ? configs.monitor.address : '';
      const { lnglat } = await prompts({ type: 'text', name: 'lnglat', message: '经纬度', initial: defaultLngLat }, PromptsOptions);
      const { address } = await prompts({ type: 'text', name: 'address', message: '详细地址', initial: defaultAddress });
      const lat = lnglat.substring(lnglat.indexOf(',') + 1, lnglat.length);
      const lon = lnglat.substring(0, lnglat.indexOf(','));
      await LocationSign({ ...activity, ...params, address, lat, lon, name, });
      configs.monitor = { lon, lat, address, delay: configs?.monitor?.delay || 0 };
      configs.mailing = configs.mailing ? configs.mailing : { enabled: false };
      configs.cqserver = configs.cqserver ? configs.cqserver : { cq_enabled: false };
      break;
    }
    case 3: {
      // 手势签到
      await GeneralSign({ ...activity, ...params, name });
      break;
    }
    case 5: {
      // 签到码签到
      await GeneralSign({ ...activity, ...params, name });
      break;
    }
    case 0: {
      const photo = await getPPTActiveInfo({ activeId: activity.activeId, ...params });
      if (photo.ifphoto === 1) {
        // 拍照签到
        console.log('访问 https://pan-yz.chaoxing.com 并在根目录上传你想要提交的照片，格式为jpg或png，命名为 0.jpg 或 0.png');
        await prompts({ name: 'complete', type: 'confirm', message: '已上传完毕?' });
        // 获取照片objectId
        const objectId = await getObjectIdFromcxPan(params);
        if (objectId === null) return null;
        await PhotoSign({ ...params, activeId: activity.activeId, objectId, name });
      } else {
        // 普通签到
        await GeneralSign({ ...params, activeId: activity.activeId, name });
      }
    }
  }
  // 记录签到信息
  const { phone, ...rest_param } = params;
  if (phone) storeUser(phone, { phone, params: rest_param, ...configs });
})();
