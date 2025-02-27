import { Request, Response } from 'express';

const waitTime = (time: number = 100) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

const { ANT_DESIGN_PRO_ONLY_DO_NOT_USE_IN_YOUR_PRODUCTION } = process.env;

/**
 * 当前用户的权限，如果为空代表没登录
 * current user access， if is '', user need login
 * 如果是 pro 的预览，默认是有权限的
 */
let access = ANT_DESIGN_PRO_ONLY_DO_NOT_USE_IN_YOUR_PRODUCTION === 'site' ? 'admin' : '';

// 保存管理员密码
let adminPassword = 'admin';

const getAccess = () => {
  return access;
};

// 代码中会兼容本地 service mock 以及部署站点的静态数据
export default {
  // 支持值为 Object 和 Array
  'GET /api/currentUser': (req: Request, res: Response) => {
    if (!getAccess()) {
      res.status(401).send({
        data: {
          isLogin: false,
        },
        errorCode: '401',
        errorMessage: '请先登录！',
        success: true,
      });
      return;
    }
    res.send({
      success: true,
      data: {
        name: 'Serati Ma',
        avatar: 'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png',
        userid: '00000001',
        email: 'antdesign@alipay.com',
        access: getAccess(),
      },
    });
  },
  'POST /api/login': async (req: Request, res: Response) => {
    const { password, username, type } = req.body;
    await waitTime(2000);
    if (password === adminPassword && username === 'admin') {
      res.send({
        status: 'ok',
        type,
        currentAuthority: 'admin',
      });
      access = 'admin';
      return;
    }

    res.send({
      status: 'error',
      type,
      currentAuthority: 'guest',
    });
    access = 'guest';
  },
  'POST /api/logout': (req: Request, res: Response) => {
    access = '';
    res.send({ data: {}, success: true });
  },
  'POST /api/login/google/callback': {
    status: 'ok',
    type: 'google',
    currentAuthority: 'admin',
    accessToken: 'google-mock-access-token-12345',
  },
  'POST /api/login/account': {
    status: 'ok',
    type: 'account',
    currentAuthority: 'admin',
    accessToken: 'mock-access-token-12345',
  },
  'PUT /api/updateAdminPassword': (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    // 检查用户是否已登录且是admin
    if (!getAccess() || getAccess() !== 'admin') {
      res.status(403).send({
        success: false,
        message: 'No permission to perform this operation',
      });
      return;
    }

    // 验证旧密码
    if (oldPassword !== adminPassword) {
      res.send({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    // 更新密码
    adminPassword = newPassword;

    res.send({
      success: true,
      message: 'Password changed successfully',
    });
  },
};
