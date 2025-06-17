// components/VideoGenerator.jsx (版本 v1.8 - 多图展示支持版)

"use client";

import { useState, useEffect } from 'react';
import { fal } from "@fal-ai/client";

// --- 代理配置 ---
fal.config({
  proxyUrl: "/api/fal/proxy",
});

// =======================================================================
// ===================  AI 模型总开关 (中央配置文件)  ===================
// =======================================================================
const MODELS_CONFIG = [
  {
    id: "fal-ai/bytedance/seedream/v3/text-to-image",
    name: "Seedream v3 (文生图，支持中文)",
    type: 'image',
    isActive: true,
    defaults: {
      aspectRatio: '1:1', guidanceScale: 2.5, num_images: 1,
      aspectRatioOptions: [ { value: '1:1', label: '1:1 (方屏)' }, { value: '3:4', label: '3:4' }, { value: '4:3', label: '4:3' }, { value: '16:9', label: '16:9 (宽屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '2:3', label: '2:3' }, { value: '3:2', label: '3:2' }, { value: '21:9', label: '21:9 (电影宽屏)' }, ],
    }
  },
  {
    id: "fal-ai/veo3",
    name: "Google Veo3 (文生视频)",
    type: 'video',
    isActive: true,
    defaults: {
      duration: '8s', aspectRatio: '16:9',
      durationOptions: [{ value: '8s', label: '8秒 (8s)' }],
      aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, ],
    }
  },
  {
    id: "fal-ai/kling-video/v2.1/master/image-to-video",
    name: "Kling v2.1 (图生视频)",
    type: 'video',
    isActive: true,
    defaults: {
      duration: '5', aspectRatio: '16:9', negativePrompt: 'blur, distort, and low quality', cfgScale: '0.5',
      durationOptions: [ { value: '5', label: '5秒' }, { value: '10', label: '10秒' }, ],
      aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '1:1', label: '1:1 (方屏)' }, ],
    }
  },
  {
    id: "fal-ai/flux-1/schnell",
    name: "Flux-1 (文生图 - 备用)",
    type: 'image',
    isActive: true,
    defaults: {
      image_size: 'landscape_4_3', num_inference_steps: 4, num_images: 1, enable_safety_checker: true,
      imageSizeOptions: [ { value: 'square_hd', label: '高清正方形 (1024x1024)'}, { value: 'square', label: '普通正方形 (512x512)'}, { value: 'portrait_4_3', label: '竖屏 4:3'}, { value: 'portrait_16_9', label: '竖屏 16:9'}, { value: 'landscape_4_3', label: '横屏 4:3'}, { value: 'landscape_16_9', label: '横屏 16:9'}, ]
    }
  },
];
// =======================================================================

const activeModels = MODELS_CONFIG.filter(model => model.isActive);
const initialModel = activeModels.length > 0 ? activeModels[0] : null;

export function VideoGenerator() {
  const [selectedModelId, setSelectedModelId] = useState(initialModel?.id || '');
  const selectedModelConfig = MODELS_CONFIG.find(m => m.id === selectedModelId);

  // --- 状态定义 ---
  const [prompt, setPrompt] = useState('');
  // [核心修改] 使用数组来存储所有结果
  const [mediaResults, setMediaResults] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // 参数状态
  const [duration, setDuration] = useState(initialModel?.defaults?.duration || '');
  const [aspectRatio, setAspectRatio] = useState(initialModel?.defaults?.aspectRatio || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [negativePrompt, setNegativePrompt] = useState(initialModel?.defaults?.negativePrompt || '');
  const [cfgScale, setCfgScale] = useState(initialModel?.defaults?.cfgScale || '');
  const [imageSize, setImageSize] = useState(initialModel?.defaults?.image_size || '');
  const [guidanceScale, setGuidanceScale] = useState(initialModel?.defaults?.guidanceScale || 2.5);
  const [numImages, setNumImages] = useState(initialModel?.defaults?.num_images || 1);
  const [numInferenceSteps, setNumInferenceSteps] = useState(initialModel?.defaults?.num_inference_steps || 4);
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(initialModel?.defaults?.enable_safety_checker ?? true);

  useEffect(() => {
    return () => { if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } };
  }, [imagePreviewUrl]);
  
  const handleModelChange = (newModelId) => {
    setSelectedModelId(newModelId);
    const newModelConfig = MODELS_CONFIG.find(m => m.id === newModelId);
    
    setPrompt(''); 
    setMediaResults([]); // [核心修改] 重置结果数组
    setError(null); setLogs([]); setImageFile(null); setImagePreviewUrl(null);
    
    setDuration(newModelConfig?.defaults?.duration || '');
    setAspectRatio(newModelConfig?.defaults?.aspectRatio || '');
    setNegativePrompt(newModelConfig?.defaults?.negativePrompt || '');
    setCfgScale(newModelConfig?.defaults?.cfgScale || '');
    setImageSize(newModelConfig?.defaults?.image_size || '');
    setGuidanceScale(newModelConfig?.defaults?.guidanceScale || 2.5);
    setNumImages(newModelConfig?.defaults?.num_images || 1);
    setNumInferenceSteps(newModelConfig?.defaults?.num_inference_steps || 4);
    setEnableSafetyChecker(newModelConfig?.defaults?.enable_safety_checker ?? true);
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
    setIsLoading(true); setError(null); setMediaResults([]); setLogs(["任务开始..."]);

    try {
      let inputPayload = { prompt };
      
      if (isSeedream) { Object.assign(inputPayload, { aspect_ratio: aspectRatio, guidance_scale: parseFloat(guidanceScale), num_images: parseInt(numImages, 10) }); } 
      else if (isKling) { Object.assign(inputPayload, { image_url: imageFile, duration: parseInt(duration, 10), aspect_ratio: aspectRatio, negative_prompt: negativePrompt, cfg_scale: parseFloat(cfgScale) }); } 
      else if (isFlux) { Object.assign(inputPayload, { image_size: imageSize, num_inference_steps: parseInt(numInferenceSteps, 10), num_images: parseInt(numImages, 10), enable_safety_checker: enableSafetyChecker }); }
      else if (isVeo3) { Object.assign(inputPayload, { aspect_ratio: aspectRatio, duration: duration }); }
      
      console.log(`开始请求 fal.ai, 模型: ${selectedModelId}, 参数:`, inputPayload);
      const result = await fal.subscribe(selectedModelId, {
        input: inputPayload, pollInterval: 5000, logs: true,
        onQueueUpdate: (update) => { if (update.logs) setLogs(current => [...current, ...update.logs.map(l => l.message)]); },
      });
      console.log('接收到的完整结果:', result);
      
      // [核心修改] 处理所有结果，而不仅仅是第一个
      let finalResults = [];
      const resultType = selectedModelConfig.type;

      if (resultType === 'image') {
        const images = result?.data?.images || result?.images;
        if (images && Array.isArray(images) && images.length > 0) {
            finalResults = images.map(img => ({ ...img, type: 'image' }));
        }
      } else { // video
        const videoUrl = result?.data?.video?.url || result?.video?.url;
        if (videoUrl) {
            finalResults = [{ url: videoUrl, type: 'video' }];
        }
      }

      if (finalResults.length > 0) {
        setMediaResults(finalResults);
        setLogs(current => [...current, `${resultType === 'image' ? '图片' : '视频'}生成成功!`]);
      } else {
        throw new Error(`模型返回了非预期的${resultType}数据结构。`);
      }
    } catch (err) {
      const errorMessage = '处理失败: ' + (err.message || err.toString() || '未知错误');
      setError(errorMessage); setLogs(current => [...current, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isKling = selectedModelConfig?.id.includes('kling');
  const isSeedream = selectedModelConfig?.id.includes('seedream');
  const isFlux = selectedModelConfig?.id.includes('flux');
  const isVeo3 = selectedModelConfig?.id.includes('veo3');
  const isButtonDisabled = isLoading || !prompt.trim() || (isKling && !imageFile);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6">
       <h1 className="text-3xl font-bold text-center text-gray-900">阿叁的AI (v1.8)</h1>
       {/* UI 部分... */}
        <div className="space-y-2">
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">1. 选择模型</label>
            <select id="model" className="w-full p-2 border border-gray-300 rounded-md" value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={isLoading || activeModels.length === 0}>
                {activeModels.length > 0 ? ( activeModels.map(model => ( <option key={model.id} value={model.id}>{model.name}</option> )) ) : ( <option>没有可用的模型</option> )}
            </select>
        </div>
        {isKling && ( <div className="p-3 border border-dashed border-indigo-300 rounded-md"> <label className="block text-sm font-medium text-gray-700 mb-2">Kling v2.1 专属设置</label> <input id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} className="block w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/> {imagePreviewUrl && <div className="flex justify-center mt-2"><img src={imagePreviewUrl} alt="Preview" className="max-h-40 rounded-md shadow" /></div>} </div> )}
        <div className="space-y-2"> <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. 输入提示词 (Prompt) *</label> <textarea id="prompt" rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="描述你想生成的内容..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} /> </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isSeedream && ( <> <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"><label htmlFor="guidanceScale" className="block text-sm font-medium">引导系数</label><input type="number" id="guidanceScale" step="0.1" className="w-full p-2 border border-gray-300 rounded-md" value={guidanceScale} onChange={e=>setGuidanceScale(e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="numImages" className="block text-sm font-medium">生成数量</label><input type="number" id="numImages" min="1" step="1" className="w-full p-2 border border-gray-300 rounded-md" value={numImages} onChange={e=>setNumImages(e.target.value)} disabled={isLoading}/></div> </> )}
            {isFlux && ( <> <div className="space-y-2"> <label htmlFor="imageSize" className="block text-sm font-medium">图片尺寸</label> <select id="imageSize" className="w-full p-2 border border-gray-300 rounded-md" value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.imageSizeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"><label htmlFor="numInferenceSteps" className="block text-sm font-medium">推理步数</label><input type="number" id="numInferenceSteps" min="1" step="1" className="w-full p-2 border border-gray-300 rounded-md" value={numInferenceSteps} onChange={e=>setNumInferenceSteps(e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="numImagesFlux" className="block text-sm font-medium">生成数量</label><input type="number" id="numImagesFlux" min="1" step="1" className="w-full p-2 border border-gray-300 rounded-md" value={numImages} onChange={e=>setNumImages(e.target.value)} disabled={isLoading}/></div> <div className="flex items-center space-x-2 pt-5"><input type="checkbox" id="safetyChecker" className="h-4 w-4 text-indigo-600 border-gray-300 rounded" checked={enableSafetyChecker} onChange={e => setEnableSafetyChecker(e.target.checked)} disabled={isLoading} /><label htmlFor="safetyChecker" className="block text-sm font-medium">启用安全检查</label></div> </> )}
            {isKling && ( <> <div className="space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border border-gray-300 rounded-md" value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="cfgScale" className="block text-sm font-medium">CFG Scale</label><input type="number" id="cfgScale" step="0.1" className="w-full p-2 border border-gray-300 rounded-md" value={cfgScale} onChange={e=>setCfgScale(e.target.value)} disabled={isLoading}/></div> </> )}
            {isVeo3 && ( <> <div className="space-y-2"> <label htmlFor="aspectRatioVideo" className="block text-sm font-medium">画面比例</label> <select id="aspectRatioVideo" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> </> )}
            {isKling && ( <> <div className="space-y-2"> <label htmlFor="aspectRatioKling" className="block text-sm font-medium">画面比例</label> <select id="aspectRatioKling" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"> <label htmlFor="durationKling" className="block text-sm font-medium">时长</label> <select id="durationKling" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> </> )}
        </div>
      <button className={`w-full py-3 px-4 rounded-md text-white font-semibold text-lg transition-colors ${ isButtonDisabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`} onClick={handleGenerate} disabled={isLoading || !selectedModelId}> {isLoading ? '正在处理...' : `生成${selectedModelConfig?.type === 'image' ? '图片' : '视频'}`} </button>
      
      {/* 结果显示区 */}
      <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]">
        {error && <div className="text-red-500 text-center mb-2 p-2 bg-red-50 rounded-md">{error}</div>}
        {isLoading && ( <div className="text-center text-gray-600"> <p className="mb-2">任务正在处理中...</p> <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded max-h-48 overflow-y-auto font-mono break-words"> {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)} </div> </div> )}
        
        {/* [核心修改] 结果展示区使用 .map 渲染所有结果 */}
        {mediaResults.length > 0 && !isLoading && (
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2">生成成功！</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {mediaResults.map((result, index) => (
                <div key={index} className="flex justify-center items-center p-2 border rounded-lg">
                  {result.type === 'video' && (
                    <video controls src={result.url} className="max-w-full rounded-md shadow-lg" autoPlay={index === 0} loop muted playsInline />
                  )}
                  {result.type === 'image' && (
                    <img src={result.url} alt={`Generated result ${index + 1}`} className="max-w-full rounded-md shadow-lg" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && mediaResults.length === 0 && !error && <div className="text-center text-gray-400">生成的媒体将在此处显示</div>}
      </div>
    </div>
  );
}

export default VideoGenerator;