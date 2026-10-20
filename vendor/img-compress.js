/* 上传前压缩图片（长边上限 + JPEG 质量），把聊天截图从几 MB 压到几百 KB
 * 用法：const f = await compressImage(file)   // 失败/非图片/本来就很小时原样返回
 * 目的：省 Supabase Storage 空间和出站流量（2026-10-20 额度超限事故后加）
 */
(function () {
  var MAX_EDGE = 1800;     // 长边像素上限：手机长截图 1080×2400 → 810×1800，聊天文字仍看得清
  var QUALITY = 0.82;      // JPEG 质量
  var SKIP_BYTES = 260 * 1024;  // 本来小于 260KB 就不压，避免越压越大

  window.compressImage = function (file, maxEdge, quality) {
    return new Promise(function (resolve) {
      try {
        if (!file || !/^image\//.test(file.type || '')) return resolve(file);
        if (file.size && file.size <= SKIP_BYTES) return resolve(file);
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth, h = img.naturalHeight;
            var limit = maxEdge || MAX_EDGE;
            var scale = Math.min(1, limit / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));
            var cv = document.createElement('canvas');
            cv.width = cw; cv.height = ch;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff';           // PNG 透明底转 JPEG 会变黑，先铺白
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            cv.toBlob(function (blob) {
              URL.revokeObjectURL(url);
              if (!blob || blob.size >= file.size) return resolve(file);
              var name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
              try { resolve(new File([blob], name, { type: 'image/jpeg' })); }
              catch (e) { blob.name = name; resolve(blob); }
            }, 'image/jpeg', quality || QUALITY);
          } catch (e) { URL.revokeObjectURL(url); resolve(file); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      } catch (e) { resolve(file); }
    });
  };
})();
