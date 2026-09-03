-- 质检记录图片恢复 SQL（按上传时间尽力匹配，仅恢复当前图片为空的已讲解记录）
-- 在 Supabase 控制台 SQL Editor 执行；管理员身份绕过 RLS，可写。
-- 安全护栏：只更新「当前图片数组为空」的记录，避免覆盖仍有图的记录。

-- 记录 1788249112895801: 恢复 2 张 -> img_1788249110610_m0v0hw, img_1788249156920_3jbl04
UPDATE qc_records SET scene_images = ARRAY['img_1788249110610_m0v0hw', 'img_1788249156920_3jbl04'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788249112895801 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788249184779118: 恢复 1 张 -> img_1788249203105_q98qn1
UPDATE qc_records SET scene_images = ARRAY['img_1788249203105_q98qn1'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788249184779118 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788249234194124: 恢复 2 张 -> img_1788249291151_h2zjxf, img_1788249329660_e3y4az
UPDATE qc_records SET scene_images = ARRAY['img_1788249291151_h2zjxf', 'img_1788249329660_e3y4az'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788249234194124 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788249362117958: 恢复 1 张 -> img_1788249483936_zlzfvu
UPDATE qc_records SET scene_images = ARRAY['img_1788249483936_zlzfvu'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788249362117958 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788249577989027: 恢复 1 张 -> img_1788250152178_k2esa8
UPDATE qc_records SET scene_images = ARRAY['img_1788250152178_k2esa8'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788249577989027 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788251696234449: 恢复 2 张 -> img_1788253516744_wrytng, img_1788253524406_sbi5tp
UPDATE qc_records SET scene_images = ARRAY['img_1788253516744_wrytng', 'img_1788253524406_sbi5tp'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788251696234449 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788253807517166: 恢复 1 张 -> img_1788254034982_bwka0i
UPDATE qc_records SET scene_images = ARRAY['img_1788254034982_bwka0i'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788253807517166 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788254175233078: 恢复 1 张 -> img_1788254382643_mgdtnv
UPDATE qc_records SET scene_images = ARRAY['img_1788254382643_mgdtnv'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788254175233078 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788254704590756: 恢复 1 张 -> img_1788255408633_1t2zfy
UPDATE qc_records SET scene_images = ARRAY['img_1788255408633_1t2zfy'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788254704590756 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788255474262184: 恢复 2 张 -> img_1788255537197_p9orts, img_1788255543584_2um6wr
UPDATE qc_records SET scene_images = ARRAY['img_1788255537197_p9orts', 'img_1788255543584_2um6wr'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788255474262184 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788255568718790: 恢复 1 张 -> img_1788270974953_vcrfrt
UPDATE qc_records SET scene_images = ARRAY['img_1788270974953_vcrfrt'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788255568718790 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788271004703242: 恢复 1 张 -> img_1788271891333_x8prkd
UPDATE qc_records SET scene_images = ARRAY['img_1788271891333_x8prkd'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788271004703242 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788276538090896: 恢复 2 张 -> img_1788276486750_wafyat, img_1788276498147_x2xk28
UPDATE qc_records SET scene_images = ARRAY['img_1788276486750_wafyat', 'img_1788276498147_x2xk28'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788276538090896 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788271916342192: 恢复 1 张 -> img_1788276506295_vamase
UPDATE qc_records SET scene_images = ARRAY['img_1788276506295_vamase'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788271916342192 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788276554320089: 恢复 1 张 -> img_1788276661556_wuktzh
UPDATE qc_records SET scene_images = ARRAY['img_1788276661556_wuktzh'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788276554320089 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788276736290754: 恢复 1 张 -> img_1788276820648_p42pue
UPDATE qc_records SET scene_images = ARRAY['img_1788276820648_p42pue'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788276736290754 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788276892335097: 恢复 1 张 -> img_1788277015118_2l5yo8
UPDATE qc_records SET scene_images = ARRAY['img_1788277015118_2l5yo8'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788276892335097 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788277083405573: 恢复 1 张 -> img_1788277176599_ot6foy
UPDATE qc_records SET scene_images = ARRAY['img_1788277176599_ot6foy'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788277083405573 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788277200430396: 恢复 1 张 -> img_1788277580370_8qmpt5
UPDATE qc_records SET scene_images = ARRAY['img_1788277580370_8qmpt5'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788277200430396 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788277608416790: 恢复 1 张 -> img_1788277647886_uatjik
UPDATE qc_records SET scene_images = ARRAY['img_1788277647886_uatjik'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788277608416790 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788277680024962: 恢复 1 张 -> img_1788278001807_wbes57
UPDATE qc_records SET scene_images = ARRAY['img_1788278001807_wbes57'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788277680024962 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788278058075234: 恢复 1 张 -> img_1788278042904_ber7h3
UPDATE qc_records SET scene_images = ARRAY['img_1788278042904_ber7h3'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788278058075234 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788278183840051: 恢复 1 张 -> img_1788278442923_mbhp43
UPDATE qc_records SET scene_images = ARRAY['img_1788278442923_mbhp43'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788278183840051 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788278465479871: 恢复 1 张 -> img_1788278537384_v17paf
UPDATE qc_records SET scene_images = ARRAY['img_1788278537384_v17paf'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788278465479871 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788278637459622: 恢复 2 张 -> img_1788278715184_v48ymu, img_1788279024315_34efwj
UPDATE qc_records SET scene_images = ARRAY['img_1788278715184_v48ymu', 'img_1788279024315_34efwj'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788278637459622 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788279055503728: 恢复 1 张 -> img_1788279635129_15c4ce
UPDATE qc_records SET scene_images = ARRAY['img_1788279635129_15c4ce'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788279055503728 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788279739447854: 恢复 1 张 -> img_1788280217934_kf3u2l
UPDATE qc_records SET scene_images = ARRAY['img_1788280217934_kf3u2l'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788279739447854 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788280264507441: 恢复 1 张 -> img_1788280362625_pakduy
UPDATE qc_records SET scene_images = ARRAY['img_1788280362625_pakduy'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788280264507441 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788280408829914: 恢复 1 张 -> img_1788280567002_egrryr
UPDATE qc_records SET scene_images = ARRAY['img_1788280567002_egrryr'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788280408829914 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788280616571201: 恢复 1 张 -> img_1788280675230_n2k6o9
UPDATE qc_records SET scene_images = ARRAY['img_1788280675230_n2k6o9'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788280616571201 AND (scene_images IS NULL OR scene_images = '{}'::text[]);

-- 记录 1788280705220097: 恢复 1 张 -> img_1788335768808_1cwn5s
UPDATE qc_records SET scene_images = ARRAY['img_1788335768808_1cwn5s'], reply_images = ARRAY[]::text[], knowledge_images = ARRAY[]::text[] WHERE id = 1788280705220097 AND (scene_images IS NULL OR scene_images = '{}'::text[]);


-- 共恢复 31 条记录。未被匹配的孤儿图片文件（共 13 个）保留在存储桶，属删除记录残留，未动。
