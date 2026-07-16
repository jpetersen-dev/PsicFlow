import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Save, Eye, FileText, Check, ShieldAlert, Sparkles, Trash } from 'lucide-react';

export default function EditorPublicacion() {
  const router = useRouter();
  const { id } = router.query;

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [category, setCategory] = useState('Psicología Clínica');
  const [tagsString, setTagsString] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [authorId, setAuthorId] = useState('');

  // UI / Logic states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState('');

  // Fetch specialists of the organization to list as author options
  useEffect(() => {
    async function loadEditorData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Get user's profile
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, organization_id')
          .eq('user_id', user.id)
          .single();

        if (profErr || !profile) throw new Error('No se pudo cargar el perfil del especialista.');

        setOrganizationId(profile.organization_id);
        
        // Default author is the logged in user
        setAuthorId(profile.id);

        // Fetch other profiles in the same organization
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, full_name, role_name')
          .eq('organization_id', profile.organization_id);
        
        if (profiles) {
          setSpecialists(profiles);
        }

        // If editing, load the article
        if (id && typeof id === 'string') {
          const { data: article, error: artErr } = await supabase
            .from('articles')
            .select('*')
            .eq('id', id)
            .single();

          if (artErr) throw artErr;
          if (article) {
            setTitle(article.title);
            setSlug(article.slug);
            setDescription(article.description);
            setSeoDescription(article.seo_description || '');
            setContentHtml(article.content_html);
            setCategory(article.category);
            setTagsString(article.tags ? article.tags.join(', ') : '');
            setImageUrl(article.image_url || '');
            setStatus(article.status);
            setAuthorId(article.author_id || profile.id);
            setAutoSlug(false); // Disable auto-slug when editing an existing article
          }
        }
      } catch (err: any) {
        alert('Error al inicializar el editor: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    if (router.isReady) {
      loadEditorData();
    }
  }, [router.isReady, id]);

  // Handle Title changes to auto-generate slug
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autoSlug) {
      const generatedSlug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars except space/dash
        .replace(/\s+/g, '-') // spaces to dashes
        .replace(/-+/g, '-') // remove double dashes
        .replace(/(^-|-$)/g, ''); // trim starting/ending dashes
      setSlug(generatedSlug);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim() || !description.trim() || !contentHtml.trim() || !organizationId) {
      alert('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    setSaving(true);
    try {
      // Calculate reading time automatically: strip HTML tags and count words
      const textOnly = contentHtml.replace(/<[^>]*>/g, ' ').trim();
      const wordsCount = textOnly ? textOnly.split(/\s+/).length : 0;
      const readingTime = Math.ceil(wordsCount / 225) || 1; // 225 words per minute average

      // Convert tags string to array
      const tags = tagsString
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const articlePayload = {
        organization_id: organizationId,
        author_id: authorId || null,
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        seo_description: seoDescription.trim(),
        content_html: contentHtml.trim(),
        category: category.trim(),
        tags,
        image_url: imageUrl.trim() || null,
        reading_time: readingTime,
        status,
        updated_at: new Date().toISOString()
      };

      let saveError;
      if (id) {
        // Update
        const { error } = await supabase
          .from('articles')
          .update(articlePayload)
          .eq('id', id);
        saveError = error;
      } else {
        // Insert
        const { error } = await supabase
          .from('articles')
          .insert(articlePayload);
        saveError = error;
      }

      if (saveError) throw saveError;

      alert('¡Artículo guardado exitosamente!');
      router.push('/publicaciones');
    } catch (err: any) {
      alert('Error al guardar artículo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{id ? 'Editar Artículo' : 'Nuevo Artículo'} - PsicFlow</title>
      </Head>

      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        {/* Back and Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-color pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/publicaciones')}
              className="p-2 rounded-xl border border-border-color bg-white hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-all cursor-pointer flex items-center justify-center"
              title="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                Herramienta de Divulgación
              </span>
              <h1 className="text-xl md:text-2xl font-bold font-display text-text-primary leading-none">
                {id ? 'Editar Publicación' : 'Crear Nueva Publicación'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Preview Button */}
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                previewMode 
                  ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' 
                  : 'bg-white border-border-color hover:bg-bg-card-hover text-text-secondary'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{previewMode ? 'Editor' : 'Vista Previa'}</span>
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all border-0 cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Artículo'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
            <p className="text-sm text-text-secondary">Cargando datos del editor...</p>
          </div>
        ) : previewMode ? (
          /* Preview Mode Layout mimicking landing page styles */
          <div className="bg-[#FDFCFB] border border-border-color rounded-[2.5rem] p-6 md:p-10 shadow-lg space-y-8 animate-in fade-in duration-200">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <span className="px-3 py-1 bg-green-500/10 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-500/10">
                {category}
              </span>
              <h1 className="text-3xl md:text-5xl font-bold font-display text-bluegrey-900 leading-tight">
                {title || 'Título del artículo'}
              </h1>
              <p className="text-xs text-bluegrey-500 font-medium">
                Por {specialists.find(s => s.id === authorId)?.full_name || 'Terapeuta'} • 14 de Mayo, 2024
              </p>
            </div>

            {imageUrl && (
              <div className="relative aspect-[21/9] w-full rounded-[2rem] overflow-hidden border border-cream-200/50 shadow-md">
                <img src={imageUrl} alt="Portada" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="max-w-2xl mx-auto border-t border-cream-200 pt-6">
              {/* Injecting HTML body dynamically */}
              <article 
                className="prose prose-sm max-w-none text-bluegrey-700 leading-relaxed font-sans space-y-4"
                dangerouslySetInnerHTML={{ 
                  __html: contentHtml || '<p class="text-gray-400 italic">No hay contenido redactado aún.</p>' 
                }} 
              />
            </div>
          </div>
        ) : (
          /* Editor Edit Form Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metadata Fields (Left Side) */}
            <div className="lg:col-span-1 bg-bg-card border border-border-color rounded-2xl p-5 space-y-4 shadow-sm h-fit">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2 border-b border-border-color pb-2">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                <span>Configuración</span>
              </h3>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Título del Artículo *</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="ej. El Silencio como Refugio"
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary font-medium"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-text-secondary">Slug SEO *</label>
                  <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSlug}
                      onChange={(e) => setAutoSlug(e.target.checked)}
                      className="rounded border-border-color text-accent-primary focus:ring-accent-primary w-3 h-3"
                    />
                    <span>Auto-generar</span>
                  </label>
                </div>
                <input
                  required
                  type="text"
                  value={slug}
                  disabled={autoSlug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="ej. el-silencio-como-refugio"
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary font-mono disabled:opacity-60"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Categoría *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary font-medium"
                >
                  <option value="Psicología Clínica">Psicología Clínica</option>
                  <option value="Psicología">Psicología</option>
                  <option value="Relaciones">Relaciones</option>
                  <option value="Bienestar">Bienestar</option>
                  <option value="Salud Mental">Salud Mental</option>
                </select>
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Etiquetas (Separadas por comas)</label>
                <input
                  type="text"
                  value={tagsString}
                  onChange={(e) => setTagsString(e.target.value)}
                  placeholder="ej. Ansiedad, Duelo, Estrés"
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary"
                />
              </div>

              {/* Extracto SEO */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-text-secondary">Extracto SEO para Google</label>
                  <span className={`text-[10px] ${seoDescription.length > 160 ? 'text-red-500 font-semibold' : 'text-text-muted'}`}>
                    {seoDescription.length}/160
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Breve descripción de tu artículo para resultados de Google..."
                  className={`w-full px-3 py-2 bg-bg-input border rounded-xl text-sm focus:outline-none h-20 resize-none text-text-primary ${seoDescription.length > 160 ? 'border-red-500 focus:border-red-500' : 'border-border-color focus:border-accent-primary'}`}
                />
                <p className="text-[10px] text-text-muted">
                  Breve descripción de tu artículo para resultados de Google (Máx. 160 caracteres). Si lo dejas en blanco, se usará el resumen del artículo.
                </p>
              </div>

              {/* Author Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Autor del Artículo</label>
                <select
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary font-medium"
                >
                  <option value="">Seleccione autor...</option>
                  {specialists.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.full_name} ({spec.role_name === 'admin_clinica' ? 'Director' : 'Psicólogo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Image Cover URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">URL de Imagen de Portada (Unsplash/etc)</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Estado de Publicación</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('draft')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      status === 'draft'
                        ? 'bg-gray-100 border-gray-300 text-gray-700 shadow-sm'
                        : 'bg-white border-border-color hover:bg-bg-card-hover text-text-muted'
                    }`}
                  >
                    Borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('published')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      status === 'published'
                        ? 'bg-green-500 border-transparent text-white shadow-sm'
                        : 'bg-white border-border-color hover:bg-bg-card-hover text-text-muted'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Publicado</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Rich Content Fields (Right Side) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Description */}
              <div className="bg-bg-card border border-border-color rounded-2xl p-5 space-y-2 shadow-sm">
                <label className="text-xs font-semibold text-text-secondary block">Descripción Corta / Resumen *</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escriba un resumen del artículo que se mostrará en las tarjetas de previsualización..."
                  className="w-full p-3 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary resize-none font-sans"
                />
              </div>

              {/* HTML Editor */}
              <div className="bg-bg-card border border-border-color rounded-2xl p-5 space-y-2 shadow-sm flex flex-col">
                <div className="flex justify-between items-center border-b border-border-color pb-2 mb-2">
                  <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-accent-primary" />
                    <span>Contenido del Artículo (Cuerpo HTML) *</span>
                  </label>
                  <span className="text-[10px] text-text-muted italic">
                    Soporta etiquetas estándares: &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;blockquote&gt;
                  </span>
                </div>
                <textarea
                  required
                  rows={16}
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  placeholder="Redacte su artículo en formato HTML. Puede usar las clases especiales de la plantilla para citas, cajas destacadas o pasos..."
                  className="w-full p-3 bg-bg-input border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary font-mono resize-none flex-1 min-h-[400px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
