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
        if (res.statusCode === 200) {
          const data = res.data;
          
          // 业务成功
          if (data.code === 200) {
            resolve(data);
          } 
          // Token 无效，跳转登录
          else if (data.code === 401) {
            uni.removeStorageSync('token');
            uni.showToast({
              title: data.msg || 'Token无效',
              icon: 'none'
            });
            
            setTimeout(() => {
              uni.reLaunch({
                url: '/pages/login/login'
              });
            }, 1500);
            
            reject(data);
          }
          // 其他业务错误
          else {
            uni.showToast({
              title: data.msg || '请求失败',
              icon: 'none'
            });
            reject(data);
          }
        } else {
          uni.showToast({
            title: '网络错误',
            icon: 'none'
          });
          reject(res);
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
