import React from 'react';

const UserAvatar = ({ user, onClick, size = 32 }) => {
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const email = user?.email || "";
  const initial = (user?.user_metadata?.full_name || email).charAt(0).toUpperCase();

  return (
    <div 
      className="user-profile-avatar-container"
      onClick={onClick}
      style={{ position: 'relative', cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? "닉네임 변경" : email}
    >
      <div 
        className="user-profile-avatar" 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%', 
          overflow: 'hidden', 
          border: '1px solid #efefef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: avatarUrl ? 'transparent' : `hsl(${(email.length * 50) % 360}, 65%, 65%)`,
          color: 'white',
          fontWeight: 'bold',
          fontSize: size * 0.4,
          flexShrink: 0,
          transition: 'all 0.2s'
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </div>
      {onClick && (
        <div className="avatar-edit-overlay">
          <span>편집</span>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
