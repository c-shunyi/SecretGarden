function toUserProfile(user) {
  return {
    id: Number(user.id),
    account: user.account,
    nickname: user.nickname,
    birthday: user.birthday,
    bio: user.bio,
    avatarFileId: user.avatar_file_id ? Number(user.avatar_file_id) : null,
    partnerId: user.partner_id ? Number(user.partner_id) : null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function toPartnerProfile(user) {
  return {
    id: Number(user.id),
    account: user.account,
    nickname: user.nickname,
    avatarFileId: user.avatar_file_id ? Number(user.avatar_file_id) : null,
  };
}

module.exports = {
  toUserProfile,
  toPartnerProfile,
};
