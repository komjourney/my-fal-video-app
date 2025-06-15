// components/VideoGenerator.jsx (版本 v2.0 - 最终毕业版 ft. 总开关)

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
// 在这里管理你所有的模型。
// 只需将 isActive 的值在 true 和 false 之间切换，即可开启或关闭模型！
const MODELS_CONFIG = [
  {
    id: "fal-ai/flux-1/schnell",
    name: "Flux-1 (文生图)",
    type: 'image',
    isActive: true, // <-- 想关闭Flux，就改成 false
    defaults: {
      image_size: 'landscape_4_3',
      options: [
          { value: 'square_hd', label: '高清正方形 (1024x1024)'},
          { value: 'square', label: '普通正方形 (512x512)'},
          { value: 'portrait_4_3', label: '竖屏 4:3'},
          { value: 'portrait_16_9', label: '竖屏 16:9'},
          { value: 'landscape_4_3', label: '横屏 4:3'},
          { value: 'landscape_16_9', label: '横屏 16:9'},
      ]
    }
  },
  {
    id: "fal-ai/veo3",
    name: "Google Veo3 (文生视频)",
    type: 'video',
    isActive: false, // <-- 想关闭Veo3，就改成 false
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
    isActive: false, // <-- 想关闭Kling，就改成 false
    defaults: {
      duration: '5', aspectRatio: '16:9', negativePrompt: 'blur, distort, and low quality', cfgScale: '0.5',
      durationOptions: [ { value: '5', label: '5秒' }, { value: '10', label: '10秒' }, ],
      aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '1:1', label: '1:1 (方屏)' }, ],
    }
  },
];
// =======================================================================
// ===================     总开关配置结束     ===================
// =======================================================================


// 根据配置筛选出所有激活的模型
const activeModels = MODELS_CONFIG.filter(model => model.isActive);
// 动态设置初始默认选中的模型为激活列表的第一个
const initialModel = activeModels.length > 0 ? activeModels[0] : null;


export function VideoGenerator() {
  // --- 状态定义 ---
  const [selectedModelId, setSelectedModelId] = useState(initialModel?.id || '');
  
  // 动态获取当前选中模型的完整配置
  const selectedModelConfig = MODELS_CONFIG.find(m => m.id === selectedModelId);

  // 通用状态
  const [prompt, setPrompt] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('none');
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

  useEffect(() => {
    return () => { if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } };
  }, [imagePreviewUrl]);
  
  // --- 核心逻辑函数 (全部由配置驱动) ---
  const handleModelChange = (newModelId) => {
    setSelectedModelId(newModelId);
    const newModelConfig = MODELS_CONFIG.find(m => m.id === newModelId);
    
    // 重置所有状态
    setPrompt(''); setMediaUrl(null); setMediaType('none'); setError(null); setLogs([]); setImageFile(null); setImagePreviewUrl(null);
    
    // 根据新模型的配置设置默认参数
    setDuration(newModelConfig?.defaults?.duration || '');
    setAspectRatio(newModelConfig?.defaults?.aspectRatio || '');
    setNegativePrompt(newModelConfig?.defaults?.negativePrompt || '');
    setCfgScale(newModelConfig?.defaults?.cfgScale || '');
    setImageSize(newModelConfig?.defaults?.image_size || '');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreviewUrl(URL.createObjectURL(file)); } else { setImageFile(null); setImagePreviewUrl(null); }
  };

  const handleGenerate = async () => {
    // ...前面逻辑基本不变...
    if (isLoading || !prompt.trim() || (selectedModelConfig?.id.includes('kling') && !imageFile)) {
        if (!isLoading && selectedModelConfig?.id.includes('kling') && !imageFile) setError("使用 Kling 模型必须上传一张起始图片。");
        return;
    }
    setIsLoading(true); setError(null); setMediaUrl(null); setMediaType('none'); setLogs(["任务开始..."]);

    try {
      let inputPayload = { prompt };
      // 动态构建参数包
      if (selectedModelConfig.id.includes('kling')) {
        Object.assign(inputPayload, { image_url: imageFile, duration: parseInt(duration, 10), aspect_ratio: aspectRatio, negative_prompt: negativePrompt, cfg_scale: parseFloat(cfgScale) });
      } else if (selectedModelConfig.id.includes('flux')) {
        Object.assign(inputPayload, { image_size: imageSize });
      } else if (selectedModelConfig.id.includes('veo3')) {
        Object.assign(inputPayload, { aspect_ratio: aspectRatio, duration: duration });
      }
      
      console.log(`开始请求 fal.ai, 模型: ${selectedModelId}, 参数:`, inputPayload);
      const result = await fal.subscribe(selectedModelId, {
        input: inputPayload, pollInterval: 5000, logs: true,
        onQueueUpdate: (update) => { if (update.logs) setLogs(current => [...current, ...update.logs.map(l => l.message)]); },
      });
      console.log('接收到的完整结果:', result);
      
      const finalUrl = selectedModelConfig.type === 'image'
          ? (result?.data?.images?.[0]?.url)
          : (result?.data?.video?.url || result?.video?.url);

      if (finalUrl) {
        setMediaUrl(finalUrl); setMediaType(selectedModelConfig.type); setLogs(current => [...current, `${selectedModelConfig.type === 'image' ? '图片' : '视频'}生成成功!`]);
      } else {
        throw new Error(`模型返回了非预期的${selectedModelConfig.type}数据结构。`);
      }
    } catch (err) {
      const errorMessage = '处理失败: ' + (err.message || err.toString() || '未知错误');
      setError(errorMessage); setLogs(current => [...current, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isKling = selectedModelConfig?.id.includes('kling');
  const isButtonDisabled = isLoading || !prompt.trim() || (isKling && !imageFile);

  // --- 返回 UI 界面 (完全由配置驱动) ---
  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6">
       <h1 className="text-3xl font-bold text-center text-gray-900">阿叁的AI (v2.0)</h1>
       <div className="space-y-2">
        <label htmlFor="model" className="block text-sm font-medium text-gray-700">1. 选择模型</label>
        <select id="model" className="w-full p-2 border border-gray-300 rounded-md" value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={isLoading || activeModels.length === 0}>
            {activeModels.length > 0 ? (
                activeModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                ))
            ) : (
                <option>没有可用的模型</option>
            )}
        </select>
      </div>

      {isKling && ( <div className="p-3 border border-dashed border-indigo-300 rounded-md"> <label className="block text-sm font-medium text-gray-700 mb-2">Kling v2.1 专属设置</label> <input id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} className="block w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/> {imagePreviewUrl && <div className="flex justify-center mt-2"><img src={imagePreviewUrl} alt="Preview" className="max-h-40 rounded-md shadow" /></div>} </div> )}
      {selectedModelConfig?.type === 'image' && ( <div className="space-y-2 p-3 border border-dashed border-green-300 rounded-md"> <label htmlFor="imageSize" className="block text-sm font-medium text-gray-700">图片尺寸</label> <select id="imageSize" className="w-full p-2 border border-gray-300 rounded-md" value={imageSize} onChange={(e) => setImageSize(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> )}
      <div className="space-y-2"> <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. 输入提示词 (Prompt) *</label> <textarea id="prompt" rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="描述你想生成的内容..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} /> </div>
      
      {selectedModelConfig?.type === 'video' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isKling && (
                <>
                    <div className="space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border border-gray-300 rounded-md" value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} disabled={isLoading}/></div>
                    <div className="space-y-2"><label htmlFor="cfgScale" className="block text-sm font-medium">CFG Scale</label><input type="number" id="cfgScale" step="0.1" className="w-full p-2 border border-gray-300 rounded-md" value={cfgScale} onChange={e=>setCfgScale(e.target.value)} disabled={isLoading}/></div>
                </>
            )}
            <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div>
            <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> 
        </div> 
      )}

      <button className={`w-full py-3 px-4 rounded-md text-white font-semibold text-lg transition-colors ${ isButtonDisabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`} onClick={handleGenerate} disabled={isLoading || !selectedModelId}> {isLoading ? '正在处理...' : `生成${selectedModelConfig?.type === 'image' ? '图片' : '视频'}`} </button>
      <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]"> {error && <div className="text-red-500 text-center mb-2 p-2 bg-red-50 rounded-md">{error}</div>} {isLoading && ( <div className="text-center text-gray-600"> <p className="mb-2">任务正在处理中...</p> <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded max-h-48 overflow-y-auto font-mono break-words"> {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)} </div> </div> )} {mediaUrl && !isLoading && ( <div className="flex flex-col items-center"> <h3 className="text-lg font-semibold mb-2">生成成功！</h3> {mediaType === 'video' && <video controls src={mediaUrl} className="max-w-full rounded-md shadow-lg" autoPlay loop muted playsInline />} {mediaType === 'image' && <img src={mediaUrl} alt="Generated result" className="max-w-full rounded-md shadow-lg" />} </div> )} {!isLoading && !mediaUrl && !error && <div className="text-center text-gray-400">生成的媒体将在此处显示</div>} </div>
    </div>
  );
}

export default VideoGenerator;