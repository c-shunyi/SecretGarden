<template>
	<view class="page">
		<view class="header">
			<text class="title">游戏时间</text>
			<text class="subtitle">一起玩点什么吧</text>
		</view>

		<view class="game-list">
			<button class="game-card" @click="goToGame('jubensha')">
				<view class="game-icon">🎭</view>
				<text class="game-name">剧本杀</text>
			</button>
		</view>
	</view>
</template>

<script>
export default {
	methods: {
		goToGame(type) {
			uni.showToast({
				title: '功能开发中',
				icon: 'none'
			});
		}
	}
};
</script>

<style>
.page {
	height: 100vh;
	padding: 48rpx 32rpx;
    box-sizing: border-box;
	background: linear-gradient(150deg, #e8f4f8 0%, #d4e8f0 40%, #c7e0ec 100%);
	background-image: radial-gradient(
			circle at 12% 20%,
			rgba(255, 255, 255, 0.9) 0%,
			rgba(255, 255, 255, 0) 45%
		),
		linear-gradient(150deg, #e8f4f8 0%, #d4e8f0 40%, #c7e0ec 100%);
	color: #2c3e50;
	font-family: "Songti SC", "STSong", "Noto Serif SC", serif;
}

.header {
	margin-bottom: 40rpx;
	animation: fadeIn 520ms ease-out;
}

.title {
	display: block;
	font-size: 52rpx;
	letter-spacing: 2rpx;
	font-weight: 600;
}

.subtitle {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: rgba(44, 62, 80, 0.7);
}

.game-list {
	display: flex;
	flex-wrap: wrap;
	gap: 24rpx;
}

.game-card {
	width: 320rpx;
	height: 320rpx;
	padding: 40rpx;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 28rpx;
	box-shadow: 0 16rpx 32rpx rgba(52, 152, 219, 0.15);
	backdrop-filter: blur(8rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: none;
	transition: all 0.3s ease;
	animation: fadeIn 580ms ease-out;
}

.game-card::after {
	border: none;
}

.game-card:active {
	transform: scale(0.95);
	box-shadow: 0 12rpx 24rpx rgba(52, 152, 219, 0.2);
}

.game-icon {
	font-size: 120rpx;
	margin-bottom: 20rpx;
}

.game-name {
	font-size: 32rpx;
	font-weight: 600;
	color: #2c3e50;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(16rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
