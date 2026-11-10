// Content and game rules are loaded by the server only.
export const scratchTiers = [
        { id: 't1', name: 'D级配给', cost: 1000, internalEv: 0.50, mult: 1 },
        { id: 't2', name: '外勤站点', cost: 3000, internalEv: 0.56, mult: 3 },
        { id: 't3', name: '收容金库', cost: 10000, internalEv: 0.62, mult: 10 },
        { id: 't4', name: '深渊凭证', cost: 20000, internalEv: 0.68, mult: 20 },
        { id: 't5', name: '董事特批', cost: 50000, internalEv: 0.74, mult: 50 },
        { id: 't6', name: 'O5最高秘钥', cost: 100000, internalEv: 0.80, mult: 100 }
      ];
export const scratchGameTypes = [
        {
          type: 'three_match',
          sub: '集章领赏',
          title: '三印报喜',
          tagline: '集齐三枚同印，领取当班津贴',
          icon: '🔺',
          cellsCount: 12,
          baseTopPrize: 325000,
          bgBand: 'bg-[#141413] text-white',
          cardBg: 'bg-[#e8e2d2]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、刮开票面上的 12 枚公司印章',
            '二、同一收容印章凑满三枚即成一组',
            '三、组内三格津贴相加，多组可叠加'
          ]
        },
        {
          type: 'lucky_num',
          sub: '凭号领赏',
          title: '幸运号签',
          tagline: '对上领赏号码，就有一份小惊喜',
          icon: '📡',
          cellsCount: 13,
          baseTopPrize: 650000,
          bgBand: 'bg-[#26292e] text-white',
          cardBg: 'bg-[#dfe3e6]',
          accentColor: 'text-[#141413]',
          rules: [
            '一、刮开上方 3 个领赏号与核准印',
            '二、刮开下方 9 个票号，对上领赏号即得对应奖金',
            '三、对应奖金相加，再乘核准印所示倍数'
          ]
        },
        {
          type: 'step_climb',
          sub: '五站巡签',
          title: '步步添彩',
          tagline: '走过五个站点，签下一份好彩头',
          icon: '⚡',
          cellsCount: 10,
          baseTopPrize: 325000,
          bgBand: 'bg-[#4a1612] text-white',
          cardBg: 'bg-[#ebe4d8]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、五个站点各有两枚签号，共 10 格',
            '二、右侧员工签号大于左侧站点签号，即通过该站',
            '三、通过站点的奖金相加，就是本张获得金额'
          ]
        }
      ];
export const slot5x3Symbols = [
        { id: 'eye', icon: '👁️', name: '收容之眼', m3: 88, m4: 468, m5: 2600 },
        { id: 'rad', icon: '☢️', name: '高危核心', m3: 34, m4: 78, m5: 187 },
        { id: 'lock', icon: '🔺', name: '几何抑制锁', m3: 17, m4: 36, m5: 78 },
        { id: 'file', icon: '📁', name: '机密卷宗', m3: 9, m4: 18, m5: 32 },
        { id: 'dna', icon: '🧬', name: '记忆血清', m3: 6, m4: 9, m5: 15 },
        { id: 'pill', icon: '💊', name: '理智镇定剂', m3: 4, m4: 6, m5: 8 }
      ];
export const slot5x3Lines = [
        { id: 1, name: '① 中线', rows: [1, 1, 1, 1, 1] },
        { id: 2, name: '② 上线', rows: [0, 0, 0, 0, 0] },
        { id: 3, name: '③ 下线', rows: [2, 2, 2, 2, 2] },
        { id: 4, name: '④ 谷线', rows: [0, 1, 2, 1, 0] },
        { id: 5, name: '⑤ 山线', rows: [2, 1, 0, 1, 2] }
      ];
export const departmentsData = [
        {
          code: 'DIV-01 // CONTAINMENT',
          name: '收容部',
          minister: '',
          motto: '交班前请确认门锁、封条和在册数量。',
          desc: '负责全局异常实体收容单元设计、现实扭曲抑制力场维护及高危收容突破应急响应。',
          hasBgCard: false
        },
        {
          code: 'DIV-02 // TACTICAL ARMS',
          name: '武装部',
          minister: '',
          motto: '装备领用、出勤和回收均需登记。',
          desc: '统辖外勤机动特遣队与重装防卫部队，负责突发超自然现场武力接管、站点防御与高危镇压。',
          hasBgCard: false
        },
        {
          code: 'DIV-03 // LOGISTICS',
          name: '后勤部',
          minister: '',
          motto: '领用物资请登记，缺货可提交补给申请。',
          desc: '负责各收容站点物资调拨、员工考勤薪资与低保发放、娱乐室金库核算及基础设施运维。',
          hasBgCard: false
        },
        {
          code: 'DIV-04 // RESEARCH',
          name: '科研部',
          minister: '',
          motto: '实验记录请写清条件、过程和结果。',
          desc: '负责异常项目机理剖析、逆向工程开发、认知危害过滤算法研究及跨维度探测实验。',
          hasBgCard: false
        },
        {
          code: 'DIV-05 // MEDICAL',
          name: '医疗部',
          minister: '',
          motto: '身体或精神状态异常，请联系值班人员。',
          desc: '负责外勤伤员战地急救、精神污染净化、记忆消除药剂调配及全员定期心理理智评估。',
          hasBgCard: true // 绑定您上传的第3张医疗部宣发卡
        }
      ];
export const stocksData = [
        { code: 'AVED.VIV', name: 'VIVARIUM BIO-CORE // 活体生态舱指数', price: 4850, change: +3.4, holding: 0 },
        { code: 'AVED.ANC', name: 'REALITY ANCHOR // 现实扭曲抑制器', price: 3200, change: -1.8, holding: 0 },
        { code: 'AVED.MEM', name: 'CLASS-B AMNESTICS // 记忆滤除药剂', price: 1650, change: +1.2, holding: 0 }
      ];
