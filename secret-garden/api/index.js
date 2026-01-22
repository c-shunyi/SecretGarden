import request from '@/utils/request.js';

// 用户相关 API
export const authApi = {
  // 登录
  login(data) {
    return request({
      url: '/auth/login',
      method: 'POST',
      data
    });
  },
  
  // 注册
  register(data) {
    return request({
      url: '/auth/register',
      method: 'POST',
      data
    });
  }
};

// 配对相关 API
export const pairApi = {
  // 获取配对信息
  getPairInfo() {
    return request({
      url: '/pair/info',
      method: 'GET'
    });
  },
  
  // 创建配对
  createPair(data) {
    return request({
      url: '/pair/create',
      method: 'POST',
      data
    });
  }
};

// 烹饪相关 API
export const cookApi = {
  // 获取菜谱列表
  getRecipes() {
    return request({
      url: '/cook/recipes',
      method: 'GET'
    });
  }
};
