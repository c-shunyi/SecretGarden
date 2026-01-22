<template>
	<view class="page">
		<view class="hero">
			<text class="title">Secret Garden</text>
			<text class="subtitle">你们的小秘密厨房</text>
		</view>

		<view v-if="!paired" class="card">
			<text class="section-title">绑定彼此</text>
			<text class="section-desc">生成邀请码让对方加入，记录共享。</text>

			<button class="btn primary" :loading="inviteLoading" @click="createInvite">
				生成邀请码
			</button>

			<view v-if="inviteCode" class="invite">
				<text class="label">邀请码</text>
				<text class="code">{{ inviteCode }}</text>
				<text class="hint">有效期至 {{ inviteExpiresAt }}</text>
			</view>

			<view class="divider"></view>

			<view class="row">
				<input
					class="input"
					v-model="acceptCode"
					placeholder="输入邀请码"
					placeholder-class="input-placeholder"
				/>
				<button class="btn" :loading="acceptLoading" @click="acceptInvite">
					绑定
				</button>
			</view>
		</view>

		<view v-else class="card">
			<view class="partner">
				<text class="section-title">已绑定</text>
				<text class="partner-name">{{ partnerName }}</text>
			</view>

			<view class="status">
				<text class="status-title">{{ hasRecordToday ? '今日已炒' : '今日未炒' }}</text>
				<text class="status-count">今日 {{ todayCount }} 次</text>
				<text v-if="lastRecordAt" class="status-meta">
					最近：{{ lastRecordAt }} · {{ lastRecordByName }}
				</text>
			</view>

			<view class="cook-action">
				<button
					class="btn-circle"
					:class="{ active: !hasRecordToday }"
					:disabled="hasRecordToday || recordLoading"
					:loading="recordLoading"
					@click="recordCook('main')"
				>
					<text class="btn-text">{{ hasRecordToday ? '美味' : '炒了吗' }}</text>
				</button>
			</view>

			<button
				v-if="hasRecordToday"
				class="btn ghost"
				:disabled="recordLoading"
				:loading="recordLoading"
				@click="recordCook('extra')"
			>
				再炒一次
			</button>
		</view>
		
		<!-- 悬浮按钮 -->
		<view class="float-btn" @click="goToGame">
			<text class="float-icon">🎮</text>
		</view>
	</view>
</template>

<script>
	const DEFAULT_API_BASE = 'http://localhost:3000'

	export default {
		data() {
			return {
				apiBase: DEFAULT_API_BASE,
				paired: false,
				partner: null,
				inviteCode: '',
				inviteExpiresAt: '',
				acceptCode: '',
				hasRecordToday: false,
				todayCount: 0,
				lastRecordAt: '',
				lastRecordByName: '',
				inviteLoading: false,
				acceptLoading: false,
				recordLoading: false,
				statusLoading: false
			}
		},
		computed: {
			partnerName() {
				return this.partner ? this.partner.username : '未命名'
			}
		},
		onShow() {
			this.init()
		},
		methods: {
			getApiBase() {
				const customBase = uni.getStorageSync('apiBase')
				return customBase || DEFAULT_API_BASE
			},
			getToken() {
				return uni.getStorageSync('token')
			},
			request({ url, method = 'GET', data = {} }) {
				const token = this.getToken()
				return new Promise((resolve, reject) => {
					uni.request({
						url: `${this.getApiBase()}${url}`,
						method,
						data,
						header: {
							'Content-Type': 'application/json',
							...(token ? { Authorization: `Bearer ${token}` } : {})
						},
						success: (res) => {
							const payload = res.data || {}
							if (payload.code === 0) {
								resolve(payload.data)
								return
							}
							reject(payload.msg || '请求失败')
						},
						fail: (err) => {
							reject(err.errMsg || '网络错误')
						}
					})
				})
			},
			async init() {
				this.apiBase = this.getApiBase()
				await this.fetchPairStatus()
				if (this.paired) {
					await this.fetchCookStatus()
				}
			},
			async fetchPairStatus() {
				this.statusLoading = true
				try {
					const data = await this.request({ url: '/api/pair/status' })
					this.paired = Boolean(data.paired)
					this.partner = data.partner || null
					if (!this.paired) {
						this.resetCookState()
					}
				} catch (error) {
					this.paired = false
					this.partner = null
					this.resetCookState()
					this.toast(error)
				} finally {
					this.statusLoading = false
				}
			},
			async fetchCookStatus() {
				this.statusLoading = true
				try {
					const data = await this.request({ url: '/api/cook/status' })
					this.hasRecordToday = Boolean(data.hasRecordToday)
					this.todayCount =
						typeof data.todayCount === 'number' ? data.todayCount : 0
					this.lastRecordAt = data.lastRecordAt
						? this.formatDateTime(data.lastRecordAt)
						: ''
					this.lastRecordByName = data.lastRecordBy && data.lastRecordBy.username
						? data.lastRecordBy.username
						: ''
				} catch (error) {
					this.toast(error)
				} finally {
					this.statusLoading = false
				}
			},
			resetCookState() {
				this.hasRecordToday = false
				this.todayCount = 0
				this.lastRecordAt = ''
				this.lastRecordByName = ''
			},
			toast(message) {
				uni.showToast({
					title: message || '操作失败',
					icon: 'none'
				})
			},
			formatDateTime(value) {
				const date = new Date(value)
				if (Number.isNaN(date.getTime())) {
					return ''
				}
				const year = date.getFullYear()
				const month = String(date.getMonth() + 1).padStart(2, '0')
				const day = String(date.getDate()).padStart(2, '0')
				const hours = String(date.getHours()).padStart(2, '0')
				const minutes = String(date.getMinutes()).padStart(2, '0')
				return `${year}-${month}-${day} ${hours}:${minutes}`
			},
			async createInvite() {
				if (this.inviteLoading) {
					return
				}
				this.inviteLoading = true
				try {
					const data = await this.request({
						url: '/api/pair/invite',
						method: 'POST',
						data: { ttlMinutes: 120 }
					})
					this.inviteCode = data.code
					this.inviteExpiresAt = this.formatDateTime(data.expiresAt)
				} catch (error) {
					this.toast(error)
				} finally {
					this.inviteLoading = false
				}
			},
			async acceptInvite() {
				const code = (this.acceptCode || '').trim().toUpperCase()
				if (!code) {
					this.toast('请输入邀请码')
					return
				}
				if (this.acceptLoading) {
					return
				}
				this.acceptLoading = true
				try {
					const data = await this.request({
						url: '/api/pair/accept',
						method: 'POST',
						data: { code }
					})
					this.paired = true
					this.partner = data.partner || null
					this.acceptCode = ''
					this.inviteCode = ''
					this.inviteExpiresAt = ''
					await this.fetchCookStatus()
				} catch (error) {
					this.toast(error)
				} finally {
					this.acceptLoading = false
				}
			},
			async recordCook(source) {
				if (this.recordLoading) {
					return
				}
				this.recordLoading = true
				try {
					await this.request({
						url: '/api/cook/record',
						method: 'POST',
						data: { source }
					})
					await this.fetchCookStatus()
				} catch (error) {
					this.toast(error)
				} finally {
					this.recordLoading = false
				}
			},
			goToGame() {
				uni.navigateTo({
					url: '/pages/game/game'
				});
			}
		}
	}
</script>

<style>
	.page {
		height: 100vh;
		padding: 48rpx 32rpx 80rpx;
		box-sizing: border-box;
		background: linear-gradient(150deg, #fff3e6 0%, #ffe8d6 40%, #ffe6c7 100%);
		background-image: radial-gradient(
				circle at 12% 20%,
				rgba(255, 255, 255, 0.9) 0%,
				rgba(255, 255, 255, 0) 45%
			),
			linear-gradient(150deg, #fff3e6 0%, #ffe8d6 40%, #ffe6c7 100%);
		color: #3d2c2e;
		font-family: "Songti SC", "STSong", "Noto Serif SC", serif;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.hero {
		margin-bottom: 40rpx;
		animation: rise 520ms ease-out;
	}

	.title {
		display: block;
		font-size: 52rpx;
		letter-spacing: 2rpx;
	}

	.subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 26rpx;
		color: rgba(61, 44, 46, 0.7);
	}

	.card {
		flex: 1;
		padding: 32rpx;
		background: rgba(255, 255, 255, 0.85);
		border-radius: 28rpx;
		box-shadow: 0 16rpx 32rpx rgba(222, 116, 74, 0.15);
		backdrop-filter: blur(8rpx);
		animation: rise 580ms ease-out;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.section-title {
		font-size: 34rpx;
		font-weight: 600;
	}

	.section-desc {
		margin: 14rpx 0 24rpx;
		font-size: 26rpx;
		color: rgba(61, 44, 46, 0.7);
	}

	.partner {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.partner-name {
		font-size: 30rpx;
		color: #e07a5f;
	}

	.status {
		margin-bottom: 28rpx;
	}

	.status-title {
		display: block;
		font-size: 30rpx;
		margin-bottom: 8rpx;
	}

	.status-count {
		display: block;
		font-size: 26rpx;
		color: rgba(61, 44, 46, 0.7);
	}

	.status-meta {
		display: block;
		margin-top: 8rpx;
		font-size: 24rpx;
		color: rgba(61, 44, 46, 0.55);
	}

	.invite {
		margin-top: 24rpx;
		padding: 20rpx;
		background: rgba(255, 243, 230, 0.8);
		border-radius: 20rpx;
	}

	.label {
		display: block;
		font-size: 24rpx;
		color: rgba(61, 44, 46, 0.6);
	}

	.code {
		display: block;
		margin-top: 10rpx;
		font-size: 36rpx;
		letter-spacing: 4rpx;
		color: #e07a5f;
	}

	.hint {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		color: rgba(61, 44, 46, 0.55);
	}

	.divider {
		height: 2rpx;
		background: rgba(61, 44, 46, 0.08);
		margin: 28rpx 0 24rpx;
	}

	.row {
		display: flex;
		gap: 16rpx;
		align-items: center;
	}

	.input {
		flex: 1;
		height: 72rpx;
		padding: 0 20rpx;
		border-radius: 20rpx;
		background: rgba(255, 255, 255, 0.9);
		border: 2rpx solid rgba(224, 122, 95, 0.2);
		font-size: 26rpx;
	}

	.input-placeholder {
		color: rgba(61, 44, 46, 0.35);
	}

	.btn {
		min-width: 180rpx;
		height: 72rpx;
		line-height: 72rpx;
		border-radius: 24rpx;
		background: #f3d2c1;
		color: #3d2c2e;
		font-size: 26rpx;
	}

	.btn::after {
		border: none;
	}

	.btn.primary {
		background: #e07a5f;
		color: #fffaf6;
		box-shadow: 0 12rpx 20rpx rgba(224, 122, 95, 0.3);
	}

	.btn.main {
		width: 100%;
		margin-top: 12rpx;
		font-size: 32rpx;
		letter-spacing: 2rpx;
	}

	.btn.ghost {
		width: 100%;
		margin-top: 16rpx;
		background: transparent;
		border: 2rpx solid rgba(224, 122, 95, 0.4);
		color: #e07a5f;
	}

	.btn[disabled] {
		opacity: 0.65;
	}

	.cook-action {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 60rpx 0;
	}

	.btn-circle {
		width: 320rpx;
		height: 320rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #e07a5f 0%, #f4a261 100%);
		color: #fffaf6;
		font-size: 48rpx;
		font-weight: 600;
		letter-spacing: 4rpx;
		box-shadow: 0 20rpx 40rpx rgba(224, 122, 95, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		transition: all 0.3s ease;
	}

	.btn-circle::after {
		border: none;
	}

	.btn-circle.active {
		animation: pulse 2s ease-in-out infinite;
	}

	.btn-circle[disabled] {
		background: linear-gradient(135deg, #d4a59a 0%, #e6c4b8 100%);
		box-shadow: 0 12rpx 24rpx rgba(224, 122, 95, 0.2);
		opacity: 0.8;
	}

	.btn-text {
		display: block;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 20rpx 40rpx rgba(224, 122, 95, 0.4);
		}
		50% {
			transform: scale(1.05);
			box-shadow: 0 24rpx 48rpx rgba(224, 122, 95, 0.5);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16rpx);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.float-btn {
		position: fixed;
		right: 40rpx;
		bottom: 80rpx;
		width: 120rpx;
		height: 120rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
		box-shadow: 0 12rpx 32rpx rgba(52, 152, 219, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
		transition: all 0.3s ease;
	}

	.float-btn:active {
		transform: scale(0.9);
		box-shadow: 0 8rpx 24rpx rgba(52, 152, 219, 0.3);
	}

	.float-icon {
		font-size: 56rpx;
	}
</style>
