// 请求基础配置
const BASE_URL = 'http://localhost:3000/api';

// 请求拦截器
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 获取 token
    const token = uni.getStorageSync('token');
    
    // 设置请求头
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    };
    
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success: (res) => {
        // 处理响应
        if (res.statusCode === 200 || res.statusCode === 201) {
          const data = res.data;
          
          // 业务成功 (code: 0)
          if (data.code === 0) {
            resolve(data);
          } 
          // 其他情况视为错误
          else {
            uni.showToast({
              title: data.msg || '请求失败',
              icon: 'none'
            });
            reject(data);
          }
        } 
        // Token 无效，跳转登录
        else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({
            title: res.data?.msg || 'Token无效',
            icon: 'none'
          });
          
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
          
          reject(res.data);
        }
        // 其他 HTTP 错误
        else {
          uni.showToast({
            title: res.data?.msg || '请求失败',
            icon: 'none'
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
};

export default request;
