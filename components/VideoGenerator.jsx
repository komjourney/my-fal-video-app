// components/VideoGenerator.jsx (v3.0 - The Graduation Edition)

"use client";
import { useState, useEffect } from 'react';
import { fal } from "@fal-ai/client";

fal.config({ proxyUrl: "/api/fal/proxy" });

// --- 模型配置 (无修改) ---
const MODELS_CONFIG = [
  { id: "fal-ai/bytedance/seedream/v3/text-to-image", name: "字节跳动-Seedream-3.0 (文生图 支持中文）", type: 'image', isActive: true, defaults: { aspect_ratio: '1:1', guidance_scale: 2.5, num_images: 1, seed: null } },
  { id: "fal-ai/flux-1/schnell", name: "Flux-1 (文生图)", type: 'image', isActive: true, defaults: { image_size: 'landscape_4_3' } },
  { id: "fal-ai/veo3", name: "Google Veo3 (文生视频)", type: 'video', isActive: true, defaults: { duration: '8s', aspect_ratio: '16:9' } },
  { id: "fal-ai/kling-video/v2.1/master/image-to-video", name: "Kling v2.1 (图生视频)", type: 'video', isActive: true, defaults: { duration: 5, aspect_ratio: '16:9', negative_prompt: 'blur, distort, and low quality', cfg_scale: 2.5 } },
];
// 为了方便UI渲染，我们把选项单独拿出来，不再污染核心参数
const UI_OPTIONS = {
    seedreamAspectRatio: [ { value: '1:1', label: '1:1 (正方形)' }, { value: '3:4', label: '3:4' }, { value: '4:3', label: '4:3' }, { value: '16:9', label: '16:9 (宽屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '2:3', label: '2:3' }, { value: '3:2', label: '3:2' }, { value: '21:9', label: '21:9 (超宽屏)' }, ],
    fluxImageSize: [ { value: 'square_hd', label: '高清正方形 (1024x1024)'}, { value: 'landscape_16_9', label: '横屏 16:9'}, ],
    videoDuration: [ { value: 5, label: '5秒' }, { value: 10, label: '10秒' }, ],
    videoAspectRatio: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '1:1', label: '1:1 (方屏)' }, ],
    veo3Duration: [{ value: '8s', label: '8秒 (8s)' }],
    veo3AspectRatio: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, ],
}

const activeModels = MODELS_CONFIG.filter(model => model.isActive);
const initialModel = activeModels.length > 0 ? activeModels[0] : null;

export function VideoGenerator() {
  const [selectedModelId, setSelectedModelId] = useState(initialModel?.id || '');
  const selectedModelConfig = MODELS_CONFIG.find(m => m.id === selectedModelId);
  const [prompt, setPrompt] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [params, setParams] = useState(initialModel?.defaults || {});

  useEffect(() => { return () => { if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } }; }, [imagePreviewUrl]);
  const handleModelChange = (newModelId) => {
    setSelectedModelId(newModelId);
    const newModelConfig = MODELS_CONFIG.find(m => m.id === newModelId);
    setParams(newModelConfig?.defaults || {});
    setPrompt(''); setMediaUrl(null); setMediaType('none'); setError(null); setLogs([]); setImageFile(null); setImagePreviewUrl(null);
  };
  const handleParamChange = (key, value) => { setParams(prevParams => ({ ...prevParams, [key]: value })); };
  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) { setImageFile(file); setImagePreviewUrl(URL.createObjectURL(file)); } else { setImageFile(null); setImagePreviewUrl(null); } };

  const handleGenerate = async () => {
    if (isLoading || !prompt.trim() || (isKling && !imageFile)) { if (!isLoading && isKling && !imageFile) setError("使用 Kling 模型必须上传一张起始图片。"); return; }
    setIsLoading(true); setError(null); setMediaUrl(null); setMediaType('none'); setLogs(["任务开始..."]);
    try {
      let pureInputPayload = {};
      
      // [最终修复] “精挑细选”地构建纯净的参数包
      if (isSeedream) {
        pureInputPayload = { prompt: prompt, aspect_ratio: params.aspect_ratio, guidance_scale: params.guidance_scale, num_images: params.num_images, };
        if (params.seed) pureInputPayload.seed = params.seed;
      } else if (isKling) {
        pureInputPayload = { prompt: prompt, image_url: imageFile, duration: params.duration, aspect_ratio: params.aspect_ratio, negative_prompt: params.negative_prompt, cfg_scale: params.cfg_scale, };
      } else if (isFlux) {
        pureInputPayload = { prompt: prompt, image_size: params.image_size, };
      } else { // Veo3
        pureInputPayload = { prompt: prompt, aspect_ratio: params.aspect_ratio, duration: params.duration, };
      }
      
      console.log(`开始请求 fal.ai, 模型: ${selectedModelId}, 准备好的 input 参数:`, pureInputPayload);
      
      // [最终修复] 恢复`input`包装，遵守客户端与代理之间的通信协议！
      const result = await fal.subscribe(selectedModelId, {
        input: pureInputPayload,
        logs: true,
        pollInterval: 5000,
        onQueueUpdate: (update) => { if (update.logs) setLogs(current => [...current, ...update.logs.map(l => l.message).filter(Boolean)]); },
      });
      console.log('接收到的完整结果:', result);
      
      //fal.ai返回的结果有时会包装在data里，有时不会
      const resultData = result.data || result;
      const finalUrl = resultData?.images?.[0]?.url || resultData?.video?.url;

      if (finalUrl) { setMediaUrl(finalUrl); setMediaType(selectedModelConfig.type); setLogs(current => [...current, `${selectedModelConfig.type === 'image' ? '图片' : '视频'}生成成功!`]);
      } else { throw new Error(`模型返回了非预期的${selectedModelConfig.type}数据结构。`); }
    } catch (err) {
      const errorMessage = '处理失败: ' + (err.message || err.toString() || '未知错误');
      setError(errorMessage); setLogs(current => [...current, errorMessage]);
    } finally { setIsLoading(false); }
  };
  
  const isKling = selectedModelConfig?.id.includes('kling');
  const isSeedream = selectedModelConfig?.id.includes('seedream');
  const isFlux = selectedModelConfig?.id.includes('flux');
  const isButtonDisabled = isLoading || !prompt.trim() || (isKling && !imageFile);

  return ( <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6"> <h1 className="text-3xl font-bold text-center text-gray-900">AI 媒体生成器 (v3.0 毕业版)</h1> <div className="space-y-2"> <label htmlFor="model" className="block text-sm font-medium text-gray-700">1. 选择模型</label> <select id="model" className="w-full p-2 border border-gray-300 rounded-md" value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={isLoading || activeModels.length === 0}> {activeModels.length > 0 ? ( activeModels.map(model => (<option key={model.id} value={model.id}>{model.name}</option>)) ) : ( <option>没有可用的模型</option> )} </select> </div> {isKling && ( <div className="p-3 border border-dashed border-indigo-300 rounded-md"> <label className="block text-sm font-medium text-gray-700 mb-2">Kling v2.1 专属设置</label> <input id="imageUpload" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} className="block w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/> {imagePreviewUrl && <div className="flex justify-center mt-2"><img src={imagePreviewUrl} alt="Preview" className="max-h-40 rounded-md shadow" /></div>} </div> )} <div className="space-y-2"> <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. 输入提示词 (Prompt) *</label> <textarea id="prompt" rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="描述你想生成的内容，Seedream 支持中文..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} /> </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {isSeedream && ( <> <div className="space-y-2"><label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label><select id="aspectRatio" className="w-full p-2 border border-gray-300 rounded-md" value={params.aspect_ratio} onChange={e=>handleParamChange('aspect_ratio', e.target.value)} disabled={isLoading}>{UI_OPTIONS.seedreamAspectRatio.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div> <div className="space-y-2"><label htmlFor="guidanceScale" className="block text-sm font-medium">引导强度</label><input type="number" step="0.1" id="guidanceScale" className="w-full p-2 border border-gray-300 rounded-md" value={params.guidance_scale} onChange={e=>handleParamChange('guidance_scale', parseFloat(e.target.value))} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="numImages" className="block text-sm font-medium">生成数量</label><input type="number" step="1" min="1" id="numImages" className="w-full p-2 border border-gray-300 rounded-md" value={params.num_images} onChange={e=>handleParamChange('num_images', parseInt(e.target.value, 10))} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="seed" className="block text-sm font-medium">随机种子 (可选)</label><input type="number" id="seed" className="w-full p-2 border border-gray-300 rounded-md" placeholder="留空则随机" value={params.seed || ''} onChange={e=>handleParamChange('seed', e.target.value ? parseInt(e.target.value, 10) : null)} disabled={isLoading}/></div> </> )} {isFlux && ( <div className="space-y-2"><label htmlFor="imageSize" className="block text-sm font-medium">图片尺寸</label><select id="imageSize" className="w-full p-2 border border-gray-300 rounded-md" value={params.image_size} onChange={e=>handleParamChange('image_size', e.target.value)} disabled={isLoading}>{UI_OPTIONS.fluxImageSize.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div> )} {selectedModelConfig?.type === 'video' && ( <> {isKling ? ( <> <div className="space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border rounded-md" value={params.negative_prompt} onChange={e=>handleParamChange('negative_prompt', e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="cfgScale" className="block text-sm font-medium">CFG Scale</label><input type="number" id="cfgScale" step="0.1" className="w-full p-2 border rounded-md" value={params.cfg_scale} onChange={e=>handleParamChange('cfg_scale', parseFloat(e.target.value))} disabled={isLoading}/></div> <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border rounded-md" value={params.aspect_ratio} onChange={(e) => handleParamChange('aspect_ratio', e.target.value)} disabled={isLoading}> {UI_OPTIONS.videoAspectRatio.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border rounded-md" value={params.duration} onChange={(e) => handleParamChange('duration', parseInt(e.target.value, 10))} disabled={isLoading}> {UI_OPTIONS.videoDuration.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> </> ) : ( <> <div className="space-y-2"> <label htmlFor="aspectRatio" className="block text-sm font-medium">画面比例</label> <select id="aspectRatio" className="w-full p-2 border rounded-md" value={params.aspect_ratio} onChange={(e) => handleParamChange('aspect_ratio', e.target.value)} disabled={isLoading}> {UI_OPTIONS.veo3AspectRatio.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"> <label htmlFor="duration" className="block text-sm font-medium">时长</label> <select id="duration" className="w-full p-2 border rounded-md" value={params.duration} onChange={(e) => handleParamChange('duration', e.target.value)} disabled={isLoading}> {UI_OPTIONS.veo3Duration.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> </> ) } </> )} </div> <button className={`w-full py-3 px-4 rounded-md text-white font-semibold text-lg transition-colors ${ isButtonDisabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`} onClick={handleGenerate} disabled={isLoading || !selectedModelId}> {isLoading ? '正在处理...' : `生成${selectedModelConfig?.type === 'image' ? '图片' : '视频'}`} </button> <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]"> {error && <div className="text-red-500 text-center mb-2 p-2 bg-red-50 rounded-md">{error}</div>} {isLoading && ( <div className="text-center text-gray-600"> <p className="mb-2">任务正在处理中...</p> <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded max-h-48 overflow-y-auto font-mono break-words"> {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)} </div> </div> )} {mediaUrl && !isLoading && ( <div className="flex flex-col items-center"> <h3 className="text-lg font-semibold mb-2">生成成功！</h3> {mediaType === 'video' && <video controls src={mediaUrl} className="max-w-full rounded-md shadow-lg" autoPlay loop muted playsInline />} {mediaType === 'image' && <img src={mediaUrl} alt="Generated result" className="max-w-full rounded-md shadow-lg" />} </div> )} {!isLoading && !mediaUrl && !error && <div className="text-center text-gray-400">生成的媒体将在此处显示</div>} </div> </div> );
}

export default VideoGenerator;