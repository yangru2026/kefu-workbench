-- ============================================================
-- 新增「极氧品牌定位」培训资料
-- 归属：大类「品牌背景和定位」 → 小类「极氧」
-- 内容来源：飞书云文档（品牌认知 / 品牌背景 / 品牌名由来）
-- 使用：在 Supabase SQL Editor 直接执行（可重复执行，已存在则跳过）
-- 说明：tags 字段类型自适应（text[] 或 jsonb 均可），无需手改
-- ============================================================

DO $$
DECLARE
  col_type text;
  v_exists boolean;
BEGIN
  -- 幂等：同一标题+小类已存在则跳过
  SELECT EXISTS(
    SELECT 1 FROM public.training_materials
    WHERE title = '极氧品牌定位' AND category = '极氧'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE '「极氧品牌定位」已存在，跳过插入。';
    RETURN;
  END IF;

  -- 自动检测 tags 字段类型，兼容 text[] 与 jsonb
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'training_materials'
    AND column_name = 'tags';

  IF col_type = 'ARRAY' THEN
    INSERT INTO public.training_materials (title, url, tags, brand, group_name, category)
    VALUES (
      '极氧品牌定位',
      'https://yow5cuygtx.feishu.cn/docx/FbchdkfWIoiNGPxgvv5cx6i0nwk',
      ARRAY['品牌定位','品牌背景','硅水凝胶','高透氧'],
      '极氧',
      '品牌背景和定位',
      '极氧'
    );
  ELSE
    INSERT INTO public.training_materials (title, url, tags, brand, group_name, category)
    VALUES (
      '极氧品牌定位',
      'https://yow5cuygtx.feishu.cn/docx/FbchdkfWIoiNGPxgvv5cx6i0nwk',
      '["品牌定位","品牌背景","硅水凝胶","高透氧"]'::jsonb,
      '极氧',
      '品牌背景和定位',
      '极氧'
    );
  END IF;

  RAISE NOTICE '✅ 已新增「极氧品牌定位」资料（归属：品牌背景和定位 → 极氧）。';
END $$;

-- 执行成功后，回到工作台按 Ctrl + Shift + R 强刷培训资料页，
-- 进入「品牌背景和定位」大类 → 点「极氧」小类即可看到该资料。
