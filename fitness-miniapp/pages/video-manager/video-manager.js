const ex = require('../../utils/exercises.js');
const app = getApp();

Page({
  data: {
    categories: [],
    allExercises: [],
    filteredExercises: [],
    searchKey: '',
    currentCat: 'all',
    totalExercises: 0,
    realCount: 0,
    video3dCount: 0,
    gifCount: 0,
    // 编辑弹窗
    showEdit: false,
    editName: '',
    editOldUrl: '',
    editUrl: '',
    uploading: false,
    uploadProgress: 0,
    uploadedUrl: ''
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const categories = ex.categories;
    const allNames = ex.getAllExerciseNames();
    const list = [];
    let realCount = 0, video3dCount = 0, gifCount = 0;

    allNames.forEach(name => {
      const info = ex.allExercises[name];
      const realUrl = ex.getRealVideo(name);
      const hasReal = !!realUrl;
      const has3d = !!info.video;

      let statusType, statusText;
      if (hasReal) {
        statusType = 'real';
        statusText = '🧑 真人';
        realCount++;
      } else if (has3d) {
        statusType = 'video3d';
        statusText = '🎬 3D';
        video3dCount++;
      } else {
        statusType = 'gif';
        statusText = '🖼️ 动图';
        gifCount++;
      }

      list.push({
        name,
        cat: info.cat,
        equip: info.equip,
        hasReal,
        has3d,
        statusType,
        statusText
      });
    });

    this.setData({
      categories,
      allExercises: list,
      filteredExercises: list,
      totalExercises: list.length,
      realCount,
      video3dCount,
      gifCount
    });
  },

  // 搜索
  onSearch(e) {
    const key = e.detail.value;
    this.setData({ searchKey: key });
    this.applyFilter();
  },

  // 分类筛选
  filterCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat });
    this.applyFilter();
  },

  applyFilter() {
    const { allExercises, searchKey, currentCat } = this.data;
    let filtered = allExercises;

    // 搜索过滤
    if (searchKey) {
      filtered = filtered.filter(item =>
        item.name.indexOf(searchKey) !== -1
      );
    }

    // 分类过滤
    if (currentCat === 'real') {
      filtered = filtered.filter(item => item.hasReal);
    } else if (currentCat === 'no-real') {
      filtered = filtered.filter(item => !item.hasReal);
    } else if (currentCat !== 'all') {
      filtered = filtered.filter(item => item.cat === currentCat);
    }

    this.setData({ filteredExercises: filtered });
  },

  // 打开编辑
  editVideo(e) {
    const name = e.currentTarget.dataset.name;
    const oldUrl = ex.getRealVideo(name);
    this.setData({
      showEdit: true,
      editName: name,
      editOldUrl: oldUrl,
      editUrl: oldUrl,
      uploadedUrl: ''
    });
  },

  closeEdit() {
    this.setData({
      showEdit: false,
      editName: '',
      editOldUrl: '',
      editUrl: '',
      uploading: false,
      uploadProgress: 0,
      uploadedUrl: ''
    });
  },

  // URL输入
  onUrlInput(e) {
    this.setData({ editUrl: e.detail.value });
  },

  // 从相册选择视频
  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadVideo(tempFilePath);
      },
      fail: () => {
        wx.showToast({ title: '已取消选择', icon: 'none' });
      }
    });
  },

  // 上传视频到云存储
  uploadVideo(filePath) {
    // 检查云开发是否初始化
    if (!wx.cloud || !app.globalData.cloudReady) {
      wx.showModal({
        title: '云存储未开启',
        content: '需要开启微信云开发才能上传视频。\n\n你可以：\n1. 开启云开发后上传\n2. 或者手动粘贴视频URL链接',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    this.setData({ uploading: true, uploadProgress: 0 });

    const cloudPath = 'exercise-videos/' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.mp4';

    const uploadTask = wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        // 获取文件ID
        const fileID = res.fileID;
        this.setData({
          uploading: false,
          uploadedUrl: fileID,
          editUrl: fileID
        });
        wx.showToast({ title: '上传成功！', icon: 'success' });
      },
      fail: (err) => {
        this.setData({ uploading: false });
        wx.showToast({ title: '上传失败', icon: 'none' });
        console.error('上传失败：', err);
      }
    });

    // 上传进度
    uploadTask.onProgressUpdate((res) => {
      this.setData({ uploadProgress: res.progress });
    });
  },

  // 保存
  saveVideo() {
    const { editName, editUrl } = this.data;
    if (!editUrl || !editUrl.trim()) {
      wx.showToast({ title: '请输入视频URL', icon: 'none' });
      return;
    }

    const success = ex.setRealVideo(editName, editUrl.trim());
    if (success) {
      wx.showToast({ title: '保存成功！', icon: 'success' });
      this.closeEdit();
      this.loadData();
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 删除真人视频
  removeVideo(e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除「' + name + '」的真人视频吗？\n删除后将回退到3D视频或动图。',
      success: (res) => {
        if (res.confirm) {
          ex.setRealVideo(name, '');
          wx.showToast({ title: '已删除', icon: 'none' });
          this.loadData();
        }
      }
    });
  }
});
