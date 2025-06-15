// components/VideoGenerator.jsx (版本 v1.6 - 终极决战修复版)

"use client";

import { useState, useEffect } from 'react';
import { fal } from "@fal-ai/client";

// --- 代理配置 ---
fal.config({
  proxyUrl: "/api/fal/proxy",
});

// --- 常量定义 ---
const MODEL_ID_VEO3 = "fal-ai/veo3";
const MODEL_ID_KLING_V2 = "fal-ai/kling-video/v2.1/master/image-to-video";
const MODEL_ID_FLUX = "fal-ai/flux-1/schnell";

// --- 默认值与选项定义 ---
const VEO3_DEFAULTS = { duration: '8s', aspectRatio: '16:9', durationOptions: [{ value: '8s', label: '8秒 (8s)' }], aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, ], };
const KLING_V2_DEFAULTS = { duration: '5', aspectRatio: '16:9', negativePrompt: 'blur, distort, and low quality', cfgScale: '0.5', durationOptions: [ { value: '5', label: '5秒' }, { value: '10', label: '10秒' }, ], aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '1:1', label: '1:1 (方屏)' }, ], };
const FLUX_DEFAULTS = { image_size: 'landscape_4_3', imageSizeOptions: [ { value: 'square_hd', label: '高清正方形 (1024x1024)'}, { value: 'square', label: '普通正方形 (512x512)'}, { value: 'portrait_4_3', label: '竖屏 4:3'}, { value: 'portrait_16_9', label: '竖屏 16:9'}, { value: 'landscape_4_3', label: '横屏 4:3'}, { value: 'landscape_16_9', label: '横屏 16:9'}, ] };

export function VideoGenerator() {
  // --- 状态定义 ---
  const [selectedModel, setSelectedModel] = useState(MODEL_ID_VEO3);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(VEO3_DEFAULTS.duration);
  const [aspectRatio, setAspectRatio] = useState(VEO3_DEFAULTS.aspectRatio);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [negativePrompt, setNegativePrompt] = useState(KLING_V2_DEFAULTS.negativePrompt);
  const [cfgScale, setCfgScale] = useState(KLING_V2_DEFAULTS.cfgScale);
  const [imageSize, setImageSize] = useState(FLUX_DEFAULTS.image_size);
  const [durationOptions, setDurationOptions] = useState(VEO3_DEFAULTS.durationOptions);
  const [aspectRatioOptions, setAspectRatioOptions] = useState(VEO3_DEFAULTS.aspectRatioOptions);
  const [imageSizeOptions, setImageSizeOptions] = useState(FLUX_DEFAULTS.imageSizeOptions);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    return () => { if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } };
  }, [imagePreviewUrl]);

  const handleModelChange = (newModelId) => {
    setSelectedModel(newModelId);
    setPrompt(''); setMediaUrl(null); setMediaType('none'); setError(null); setLogs([]); setImageFile(null); setImagePreviewUrl(null);
    if (newModelId === MODEL_ID_KLING_V2) {
      setDuration(KLING_V2_DEFAULTS.duration); setAspectRatio(KLING_V2_DEFAULTS.aspectRatio); setNegativePrompt(KLING_V2_DEFAULTS.negativePrompt); setCfgScale(KLING_V2_DEFAULTS.cfgScale); setDurationOptions(KLING_V2_DEFAULTS.durationOptions); setAspectRatioOptions(KLING_V2_DEFAULTS.aspectRatioOptions);
    } else if (newModelId === MODEL_ID_FLUX) {
      setImageSize(FLUX_DEFAULTS.image_size); setImageSizeOptions(FLUX_DEFAULTS.imageSizeOptions);
    } else {
      setDuration(VEO3_DEFAULTS.duration); setAspectRatio(VEO3_DEFAULTS.aspectRatio); setDurationOptions(VEO3_DEFAULTS.durationOptions); setAspectRatioOptions(VEO3_DEFAULTS.aspectRatioOptions);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreviewUrl(URL.createObjectURL(file)); } else { setImageFile(null); setImagePreviewUrl(null); }
  };

  const handleGenerate = async () => {
    if (isLoading || !prompt.trim() || (isKling && !imageFile)) {
        if (!isLoading && isKling && !imageFile) setError("使用 Kling 模型必须上传一张起始图片。");
        return;
    }
    setIsLoading(true); setError(null); setMediaUrl(null); setMediaType('none'); setLogs(["任务开始..."]);

    try {
      let inputPayload = {};
      if (isKling) {
        // [终极修复: 参数类型] 确保 duration 和 cfg_scale 都是 Number 类型
        inputPayload = {
          prompt: prompt,
          image_url: imageFile,
          duration: parseInt(duration, 10), // 必须是数字 5 或 10
          aspect_ratio: aspectRatio,
          negative_prompt: negativePrompt,
          cfg_scale: parseFloat(cfgScale) || 0.5, // 必须是浮点数
        };
      } else if (isFlux) {
        inputPayload = { prompt: prompt, image_size: imageSize, };
      } else {
        inputPayload = { prompt: prompt, aspect_ratio: aspectRatio, duration: duration, };
      }
      setLogs(current => [...current, `正在调用模型 ${selectedModel}...`]);
      console.log(`开始请求 fal.ai, 模型: ${selectedModel}, 参数:`, inputPayload);
      const result = await fal.subscribe(selectedModel, {
        input: inputPayload, pollInterval: 5000, logs: true,
        onQueueUpdate: (update) => { if (update.logs) setLogs(current => [...current, ...update.logs.map(l => l.message)]); },
      });
      console.log('接收到的完整结果:', result);
      
      let finalUrl = null;
      let finalType = 'none';
      if (isFlux) {
        finalUrl = result?.data?.images?.[0]?.url; finalType = 'image';
      } else {
        finalUrl = result?.data?.video?.url || result?.video?.url; finalType = 'video';
      }
      if (finalUrl) {
        setMediaUrl(finalUrl); setMediaType(finalType); setLogs(current => [...current, `${finalType === 'image' ? '图片' : '视频'}生成成功!`]);
      } else {
        throw new Error(`模型返回了非预期的${finalType === 'image' ? '图片' : '视频'}数据结构。`);
      }
    } catch (err) {
      const errorMessage = '处理失败: ' + (err.message || err.toString() || '未知错误');
      setError(errorMessage); setLogs(current => [...current, errorMessage]); console.error("生成媒体出错:", err);
    } finally {
      setIsLoading(false); console.log("请求结束.");
    }
  };

  const isKling = selectedModel === MODEL_ID_KLING_V2;
  const isFlux = selectedModel === MODEL_ID_FLUX;
  const isButtonDisabled = isLoading || !prompt.trim() || (isKling && !imageFile);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6">
       <h1 className="text-3xl font-bold text-center text-gray-900">AI 媒体生成器 (v1.6)</h1>
       <div className="space-y-2">
        <label htmlFor="model" className="block text-sm font-medium text-gray-700">1. 选择模型</label>
        <select id="model" className="w-full p-2 border border-gray-300 rounded-md" value={selectedModel} onChange={(e) => handleModelChange(e.target.value)} disabled={isLoading}>
          <option value={MODEL_ID_VEO3}>Google Veo3 (文生视频)</option>
          <option value={MODEL_ID_KLING_V2}>Kling v2.1 (图生视频)</option>
          <option value={MODEL_ID_FLUX}>Flux-1 (文生图)</option>
        </select>
      </div>
      {isKling && ( <div className="p-3 border border-dashed border-indigo-300 rounded-md"> <label className="block text-sm font-medium text-gray-700 mb-2">Kling v2.1 专属设置</label> <input id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} className="block w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/> {imagePreviewUrl && <div className="flex justify-center mt-2"><img src={imagePreviewUrl} alt="Preview" className="max-h-40 rounded-md shadow" /></div>} </div> )}
      {isFlux && ( <div className="space-y-2 p-3 border border-dashed border-green-300 rounded-md"> <label htmlFor="imageSize" className="block text-sm font-medium text-gray-700">图片尺寸 (Flux 专属)</label> <select id="imageSize" className="w-full p-2 border border-gray-300 rounded-md" value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={isLoading}> {imageSizeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> )}
      <div className="space-y-2"> <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. 输入提示词 (Prompt) *</label> <textarea id="prompt" rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="描述你想生成的内容..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} /> </div>
      
      {/* [终极修复: UI布局] 使用最可靠的网格布局，确保所有参数对齐 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isKling ? (
            <>
                <div className="space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border border-gray-300 rounded-md" value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} disabled={isLoading}/></div>
                <div className="space-y-2"><label htmlFor="cfgScale" className="block text-sm font-medium">CFG Scale</label><input type="number" id="cfgScale" step="0.1" className="w-full p-2 border border-gray-300 rounded-md" value={cfgScale} onChange={e=>setCfgScale(e.target.value)} disabled={isLoading}/></div>
                <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div>
                <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> 
            </>
        ) : !isFlux && (
            <>
                <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div>
                <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div>
            </>
        )}
      </div>

      <button className={`w-full py-3 px-4 rounded-md text-white font-semibold text-lg transition-colors ${ isButtonDisabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`} onClick={handleGenerate} disabled={isButtonDisabled}> {isLoading ? '正在处理...' : `生成${isFlux ? '图片' : '视频'}`} </button>
      <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]"> {error && <div className="text-red-500 text-center mb-2 p-2 bg-red-50 rounded-md">{error}</div>} {isLoading && ( <div className="text-center text-gray-600"> <p className="mb-2">任务正在处理中...</p> <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded max-h-48 overflow-y-auto font-mono break-words"> {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)} </div> </div> )} {mediaUrl && !isLoading && ( <div className="flex flex-col items-center"> <h3 className="text-lg font-semibold mb-2">生成成功！</h3> {mediaType === 'video' && <video controls src={mediaUrl} className="max-w-full rounded-md shadow-lg" autoPlay loop muted playsInline />} {mediaType === 'image' && <img src={mediaUrl} alt="Generated result" className="max-w-full rounded-md shadow-lg" />} </div> )} {!isLoading && !mediaUrl && !error && <div className="text-center text-gray-400">生成的媒体将在此处显示</div>} </div>
    </div>
  );
}

export default VideoGenerator;