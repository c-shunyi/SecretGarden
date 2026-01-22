<template>
  <view class="login-container">
    <view class="login-box">
      <text class="title">欢迎登录</text>
      
      <view class="input-group">
        <input 
          v-model="username" 
          placeholder="请输入用户名" 
          class="input"
        />
      </view>
      
      <view class="input-group">
        <input 
          v-model="password" 
          type="password" 
          placeholder="请输入密码" 
          class="input"
        />
      </view>
      
      <button @click="handleLogin" class="login-btn" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js';

export default {
  data() {
    return {
      username: '',
      password: '',
      loading: false
    };
  },
  methods: {
    async handleLogin() {
      if (!this.username || !this.password) {
        uni.showToast({
          title: '请输入用户名和密码',
          icon: 'none'
        });
        return;
      }
      
      this.loading = true;
      
      try {
        const res = await request({
          url: '/auth/login',
          method: 'POST',
          data: {
            username: this.username,
            password: this.password
          }
        });
        
        // 保存 token
        uni.setStorageSync('token', res.data.token);
        
        uni.showToast({
          title: '登录成功',
          icon: 'success'
        });
        
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/index/index'
          });
        }, 1500);
        
      } catch (error) {
        console.error('登录失败:', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 600rpx;
  padding: 60rpx;
  background: white;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.1);
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 60rpx;
  color: #333;
}

.input-group {
  margin-bottom: 30rpx;
}

.input {
  width: 100%;
  height: 80rpx;
  padding: 0 30rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 10rpx;
  font-size: 28rpx;
}

.login-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10rpx;
  font-size: 32rpx;
  margin-top: 40rpx;
}

.login-btn[disabled] {
  opacity: 0.6;
}
</style>
