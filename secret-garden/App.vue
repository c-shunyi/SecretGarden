<script>
	export default {
		onLaunch: function() {
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		},
		onError: function(err) {
			// 过滤微信开发者工具的系统错误
			if (err.includes('webapi_getwxaasyncsecinfo')) {
				return;
			}
			console.error('App Error:', err);
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
