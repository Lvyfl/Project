import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { postsAPI } from '../api';
import './Dashboard.css';

interface Post {
  id: string;
  caption: string;
  imageUrl?: string;
  createdAt: string;
  adminId: string;
}

const Dashboard: React.FC = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [updating, setUpdating] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfCaption, setPdfCaption] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pdfThumbnail, setPdfThumbnail] = useState('');
  const [pdfThumbnailPreview, setPdfThumbnailPreview] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    // Listen for auth errors from calendar iframe
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from localhost:3000 (calendar)
      if (event.origin === 'http://localhost:3000') {
        if (event.data.type === 'AUTH_ERROR') {
          console.log('Auth error received from iframe, logging out');
          logout();
          navigate('/login');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [logout, navigate]);

  const fetchPosts = async () => {
    try {
      const response = await postsAPI.getPosts();
      setPosts(response.data);
    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageUrl(base64String);
        setImagePreview(base64String);
        setError('');
      };
      reader.onerror = () => {
        setError('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await postsAPI.createPost({ caption, imageUrl: imageUrl || undefined });
      handleCloseModal();
      fetchPosts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create post');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await postsAPI.deletePost(id);
      fetchPosts();
    } catch (err) {
      alert('Failed to delete post');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setCaption('');
    setImageUrl('');
    setImagePreview('');
    setError('');
  };

  const handleOpenCaptionModal = (caption: string) => {
    setSelectedCaption(caption);
    setShowCaptionModal(true);
  };

  const handleCloseCaptionModal = () => {
    setShowCaptionModal(false);
    setSelectedCaption('');
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleOpenEditModal = (post: Post) => {
    setEditingPost(post);
    setEditCaption(post.caption);
    setEditImageUrl(post.imageUrl || '');
    setEditImagePreview(post.imageUrl || '');
    setShowEditModal(true);
    setError('');
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPost(null);
    setEditCaption('');
    setEditImageUrl('');
    setEditImagePreview('');
    setError('');
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setEditImageUrl(base64String);
        setEditImagePreview(base64String);
        setError('');
      };
      reader.onerror = () => {
        setError('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    setError('');
    setUpdating(true);

    try {
      await postsAPI.updatePost(editingPost.id, { 
        caption: editCaption, 
        imageUrl: editImageUrl || undefined 
      });
      handleCloseEditModal();
      fetchPosts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update post');
    } finally {
      setUpdating(false);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File size must be less than 10MB');
        return;
      }

      // Check file type
      if (file.type !== 'application/pdf') {
        setUploadError('Please select a PDF file');
        return;
      }

      setPdfFile(file);
      
      // Convert PDF to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPdfUrl(base64String);
        setUploadError('');
      };
      reader.onerror = () => {
        setUploadError('Failed to read PDF file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Thumbnail size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Thumbnail must be an image file');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPdfThumbnail(base64String);
        setPdfThumbnailPreview(base64String);
        setUploadError('');
      };
      reader.onerror = () => {
        setUploadError('Failed to read thumbnail file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !pdfThumbnail) {
      setUploadError('Please select both PDF file and thumbnail image');
      return;
    }

    setUploadError('');
    setUploadingPdf(true);

    try {
      // Store both PDF URL and thumbnail
      // Format: pdfUrl|thumbnailBase64
      const combinedData = `${pdfUrl}|${pdfThumbnail}`;
      
      await postsAPI.createPost({ 
        caption: pdfCaption, 
        imageUrl: combinedData
      });
      
      // Reset form
      setPdfCaption('');
      setPdfFile(null);
      setPdfThumbnail('');
      setPdfThumbnailPreview('');
      setPdfUrl('');
      
      alert('✅ Document uploaded successfully!');
      
      // Optionally switch to posts tab to see the result
      setActiveTab('posts');
      fetchPosts();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload document');
      console.error('Upload error:', err);
    } finally {
      setUploadingPdf(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-menu">
          
          <button 
            className={`sidebar-item ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <span>Posts</span>
          </button>
          
          <button 
            className={`sidebar-item ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
            <span>Announcements</span>
          </button>
          
          <button 
            className={`sidebar-item ${activeTab === 'uploadPdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('uploadPdf')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span>Upload PDF</span>
          </button>
          
          <button 
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <h1>
              <span className="brand-ceit">CEIT</span>{' '}
              <span className="brand-admin">Admin Portal</span>
            </h1>
          </div>
          <div className="header-right">
            <div className="user-badge">
              <div className="user-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="content">
          {activeTab === 'posts' && (
            <>
              {loading ? (
                <div className="loading">Loading posts...</div>
              ) : posts.length === 0 ? (
                <div className="no-posts">
                  <button onClick={() => setShowCreateModal(true)} className="create-first-btn">
                    + Create your first post
                  </button>
                </div>
              ) : (
                <>
                  <div className="posts-controls">
                    <button onClick={() => setShowCreateModal(true)} className="create-post-btn">
                      + New Post
                    </button>
                  </div>
                  <div className="posts-grid">
                    {posts.map((post) => {
                      // Detect if it's a PDF
                      const isPDF = post.imageUrl?.includes('data:application/pdf') || 
                                   post.imageUrl?.endsWith('.pdf') || 
                                   post.imageUrl?.includes('|');
                      const [pdfUrl, thumbnailUrl] = post.imageUrl?.includes('|') 
                        ? post.imageUrl.split('|') 
                        : [post.imageUrl, null];
                      
                      // Check if it's a valid base64 PDF or old mock URL
                      const isValidPdf = isPDF && pdfUrl?.startsWith('data:application/pdf');
                      const isOldMockUrl = isPDF && pdfUrl?.includes('example.com');
                      
                      return (
                        <div key={post.id} className="post-card">
                          <div className="post-body">
                            <p className="post-title">{truncateText(post.caption, 150)}</p>
                            {post.caption.length > 150 && (
                              <button 
                                className="read-more-btn"
                                onClick={() => handleOpenCaptionModal(post.caption)}
                              >
                                Read more
                              </button>
                            )}
                          </div>
                          {post.imageUrl && (
                            <div>
                              {isPDF && thumbnailUrl && (
                                <img src={thumbnailUrl} alt="PDF Thumbnail" className="post-image" />
                              )}
                              {isPDF && !thumbnailUrl && (
                                <div style={{ padding: '20px', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
                                  📄 PDF Document
                                </div>
                              )}
                              {!isPDF && (
                                <img src={post.imageUrl} alt="Post" className="post-image" />
                              )}
                              {isValidPdf && (
                                <div style={{ padding: '8px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginTop: '8px', fontSize: '14px' }}>
                                  ✅ PDF Ready to View
                                </div>
                              )}
                              {isOldMockUrl && (
                                <div style={{ padding: '8px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginTop: '8px', fontSize: '14px', border: '1px solid #ef9a9a' }}>
                                  ⚠️ Old PDF - Please Delete and Re-upload
                                </div>
                              )}
                            </div>
                          )}
                          <div className="post-footer">
                          <span className="post-date">
                            {new Date(post.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {post.adminId === user?.id && (
                            <div className="post-actions">
                              <button
                                onClick={() => handleOpenEditModal(post)}
                                className="edit-post-btn"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="delete-post-btn"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'announcements' && (
            <div className="page-content calendar-container">
              <iframe 
                src={`http://localhost:3000/calendar.html?token=${token}`}
                title="Events Calendar"
                style={{
                  width: '70%',
                  height: '850px',
                  border: 'none',
                  borderRadius: '8px'
                }}
              />
            </div>
          )}

          {activeTab === 'uploadPdf' && (
            <div className="page-content upload-pdf-content">
              <div className="upload-pdf-section">
                <h2>📄 Upload PDF Document</h2>
                <p className="section-description">Upload PDF documents to share with your department</p>
                
                <form onSubmit={handlePdfUpload} className="pdf-upload-form">
                  <div className="form-group">
                    <label>Document Caption *</label>
                    <textarea
                      value={pdfCaption}
                      onChange={(e) => setPdfCaption(e.target.value)}
                      required
                      rows={4}
                      placeholder="Enter a description for this document..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>PDF File *</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfFileChange}
                        required
                        id="pdf-file-input"
                        className="file-input"
                      />
                      <label htmlFor="pdf-file-input" className="file-input-label">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>{pdfFile ? pdfFile.name : 'Choose PDF File'}</span>
                      </label>
                    </div>
                    {pdfFile && (
                      <div className="file-info">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{pdfFile.name}</span>
                        <span className="file-size">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPdfFile(null);
                            setPdfUrl('');
                          }}
                          className="remove-file-btn"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Thumbnail Image *</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        required
                        id="thumbnail-input"
                        className="file-input"
                      />
                      <label htmlFor="thumbnail-input" className="file-input-label">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>{pdfThumbnailPreview ? 'Change Thumbnail' : 'Choose Thumbnail Image'}</span>
                      </label>
                    </div>
                    {pdfThumbnailPreview && (
                      <div className="thumbnail-preview">
                        <img src={pdfThumbnailPreview} alt="Thumbnail preview" />
                        <button
                          type="button"
                          onClick={() => {
                            setPdfThumbnail('');
                            setPdfThumbnailPreview('');
                          }}
                          className="remove-thumbnail-btn"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {uploadError && <div className="error">{uploadError}</div>}
                  
                  <div className="form-actions">
                    <button 
                      type="submit" 
                      disabled={uploadingPdf || !pdfFile || !pdfThumbnail}
                      className="upload-btn"
                    >
                      {uploadingPdf ? '📤 Uploading...' : '📤 Upload Document'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="page-content">
              <h2>Settings</h2>
              <p>Settings coming soon</p>
            </div>
          )}
        </main>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Post</h3>
              <button onClick={handleCloseModal} className="close-btn">
                ×
              </button>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="form-group">
                <label>Caption *</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  required
                  rows={4}
                  placeholder="What's on your mind?"
                />
              </div>
              <div className="form-group">
                <label>Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setImagePreview('');
                      }}
                      className="remove-image-btn"
                    >
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="submit-btn">
                  {creating ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {showEditModal && editingPost && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Post</h3>
              <button onClick={handleCloseEditModal} className="close-btn">
                ×
              </button>
            </div>
            <form onSubmit={handleUpdatePost}>
              <div className="form-group">
                <label>Caption *</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  required
                  rows={4}
                  placeholder="What's on your mind?"
                />
              </div>
              <div className="form-group">
                <label>Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                />
                {editImagePreview && (
                  <div className="image-preview">
                    <img src={editImagePreview} alt="Preview" />
                    <button
                      type="button"
                      onClick={() => {
                        setEditImageUrl('');
                        setEditImagePreview('');
                      }}
                      className="remove-image-btn"
                    >
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" disabled={updating} className="submit-btn">
                  {updating ? 'Updating...' : 'Update Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Caption Modal */}
      {showCaptionModal && (
        <div className="modal-overlay" onClick={handleCloseCaptionModal}>
          <div className="modal caption-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Full Caption</h3>
              <button onClick={handleCloseCaptionModal} className="close-btn">
                ×
              </button>
            </div>
            <div className="caption-modal-content">
              <p className="full-caption-text">{selectedCaption}</p>
            </div>
            <div className="modal-actions">
              <button onClick={handleCloseCaptionModal} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
