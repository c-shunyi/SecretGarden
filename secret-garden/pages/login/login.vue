<template>
  <view class="login-container">
    <view class="login-box">
      <view class="tabs">
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 'login' }"
          @click="activeTab = 'login'"
        >
          登录
        </view>
        <view 
          class="tab-item" 
          :class="{ active: activeTab === 'register' }"
          @click="activeTab = 'register'"
        >
          注册
        </view>
      </view>
      
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
      
      <view v-if="activeTab === 'register'" class="input-group">
        <input 
          v-model="confirmPassword" 
          type="password" 
          placeholder="请确认密码" 
          class="input"
        />
      </view>
      
      <button 
        @click="activeTab === 'login' ? handleLogin() : handleRegister()" 
        class="login-btn" 
        :disabled="loading"
      >
        {{ loading ? (activeTab === 'login' ? '登录中...' : '注册中...') : (activeTab === 'login' ? '登录' : '注册') }}
      </button>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js';

export default {
  data() {
    return {
      activeTab: 'login',
      username: '',
      password: '',
      confirmPassword: '',
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
          uni.reLaunch({
            url: '/pages/index/index'
          });
        }, 1500);
        
      } catch (error) {
        console.error('登录失败:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async handleRegister() {
      if (!this.username || !this.password || !this.confirmPassword) {
        uni.showToast({
          title: '请填写完整信息',
          icon: 'none'
        });
        return;
      }
      
      if (this.password !== this.confirmPassword) {
        uni.showToast({
          title: '两次密码不一致',
          icon: 'none'
        });
        return;
      }
      
      if (this.password.length < 6) {
        uni.showToast({
          title: '密码至少6位',
          icon: 'none'
        });
        return;
      }
      
      this.loading = true;
      
      try {
        const res = await request({
          url: '/auth/register',
          method: 'POST',
          data: {
            username: this.username,
            password: this.password
          }
        });
        
        uni.showToast({
          title: '注册成功，请登录',
          icon: 'success'
        });
        
        // 切换到登录页
        setTimeout(() => {
          this.activeTab = 'login';
          this.password = '';
          this.confirmPassword = '';
        }, 1500);
        
      } catch (error) {
        console.error('注册失败:', error);
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

.tabs {
  display: flex;
  margin-bottom: 60rpx;
  border-bottom: 2rpx solid #e0e0e0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 32rpx;
  color: #999;
  position: relative;
  transition: all 0.3s;
}

.tab-item.active {
  color: #667eea;
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -2rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 4rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2rpx;
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
  transition: border-color 0.3s;
}

.input:focus {
  border-color: #667eea;
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
  transition: opacity 0.3s;
}

.login-btn[disabled] {
  opacity: 0.6;
}
</style>
