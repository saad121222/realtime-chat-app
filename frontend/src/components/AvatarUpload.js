import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function AvatarUpload({ currentAvatar, onAvatarUpdate, size = 'large' }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentAvatar);
  const fileInputRef = useRef(null);

  const sizeClasses = {
    small: 'avatar-upload-small',
    medium: 'avatar-upload-medium',
    large: 'avatar-upload-large'
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const validateAndUpload = async (file) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadAvatar(file);
  };

  const uploadAvatar = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.avatar) {
        setPreview(response.data.avatar);
        onAvatarUpdate(response.data.avatar, response.data.user);
        toast.success('Avatar updated successfully!');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
      setPreview(currentAvatar); // Reset preview on error
    } finally {
      setUploading(false);
    }
  };

  const generateInitialsAvatar = async () => {
    setUploading(true);
    try {
      const response = await api.post('/users/avatar/initials');
      
      if (response.data.avatar) {
        setPreview(response.data.avatar);
        onAvatarUpdate(response.data.avatar, response.data.user);
        toast.success('Avatar generated successfully!');
      }
    } catch (error) {
      console.error('Generate avatar error:', error);
      toast.error(error.response?.data?.message || 'Failed to generate avatar');
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async () => {
    setUploading(true);
    try {
      const response = await api.delete('/users/avatar');
      
      setPreview('');
      onAvatarUpdate('', response.data.user);
      toast.success('Avatar deleted successfully!');
    } catch (error) {
      console.error('Delete avatar error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={`avatar-upload ${sizeClasses[size]}`}>
      <div 
        className="avatar-container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        {preview ? (
          <img 
            src={preview} 
            alt="Avatar" 
            className="avatar-image"
          />
        ) : (
          <div className="avatar-placeholder">
            <span className="avatar-icon">📷</span>
            <span className="avatar-text">Add Photo</span>
          </div>
        )}
        
        {uploading && (
          <div className="avatar-overlay">
            <div className="spinner"></div>
          </div>
        )}
        
        <div className="avatar-hover-overlay">
          <span className="change-text">Change Photo</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="avatar-actions">
        <button
          type="button"
          className="btn-secondary small"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          Upload Photo
        </button>
        
        <button
          type="button"
          className="btn-secondary small"
          onClick={generateInitialsAvatar}
          disabled={uploading}
        >
          Generate Avatar
        </button>
        
        {preview && (
          <button
            type="button"
            className="btn-danger small"
            onClick={deleteAvatar}
            disabled={uploading}
          >
            Remove
          </button>
        )}
      </div>

      <div className="avatar-help">
        <small className="muted">
          Drag and drop an image or click to browse. Max size: 5MB
        </small>
      </div>
    </div>
  );
}
