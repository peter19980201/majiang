"""可选独立核验：Python mahjong==1.4.0；不导入项目计算引擎。
安装于隔离环境后：python test/winning-hands-oracle.py
用 Node 仅导出静态用例定义，番符计算全部交给独立 Python 库。
"""
import json
import sys
import hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
import re
import subprocess
from pathlib import Path
from importlib.metadata import version
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
from mahjong.meld import Meld

assert version('mahjong') == '1.4.0', '请使用锁定的 mahjong==1.4.0'
root = Path(__file__).resolve().parent
cases = json.loads(subprocess.check_output(
    ['node', '-e', 'process.stdout.write(JSON.stringify(require("./winning-hands.cases")))'], cwd=root))

names = dict(item.split('=') for item in '''
Tsumo=门前清自摸和 Riichi=立直 Ippatsu=一发 Chankan=抢杠 Rinshan=岭上开花
Haitei=海底摸月 Houtei=河底捞鱼 DaburuRiichi=双立直 Pinfu=平和 Tanyao=断幺九
Iipeiko=一杯口 Haku=役牌:白 Hatsu=役牌:发 Chun=役牌:中
YakuhaiOfPlace=役牌:自风 YakuhaiOfRound=役牌:场风 Sanshoku=三色同顺
Ittsu=一气通贯 Chantai=混全带幺九 Honroto=混老头 Toitoi=对对和 Sanankou=三暗刻
SanKantsu=三杠子 SanshokuDoukou=三色同刻 Chiitoitsu=七对子 Shosangen=小三元
Honitsu=混一色 Junchan=纯全带幺九 Ryanpeikou=二杯口 Chinitsu=清一色
KokushiMusou=国士无双 DaburuKokushiMusou=国士无双十三面 Suuankou=四暗刻
SuuankouTanki=四暗刻单骑 Daisangen=大三元 Tsuuiisou=字一色 Ryuuiisou=绿一色
Chinroutou=清老头 Shousuushii=小四喜 DaiSuushii=大四喜 Suukantsu=四杠子
ChuurenPoutou=九莲宝灯 DaburuChuurenPoutou=纯正九莲宝灯 Tenhou=天和 Chiihou=地和
Dora=宝牌 AkaDora=赤宝牌
'''.split())

def parse(text):
    tiles = []
    for token in re.findall(r'[1-9]+[mps]|[東南西北白发中]', text):
        if len(token) == 1:
            tiles.append(27 + '東南西北白发中'.index(token))
        else:
            tiles.extend(9 * 'mps'.index(token[-1]) + int(n) - 1 for n in token[:-1])
    return tiles

def evaluate(case):
    ctx = case['context']
    red = ctx.get('redDora', {})
    # 分配真实136牌ID。只有明确指定的红五使用编号0的副本。
    pools = {}
    for t in range(34):
        copies = [0, 1, 2, 3]
        if t in (4, 13, 22) and not red.get(['m5', 'p5', 's5'][(t - 4) // 9], 0):
            copies = [1, 2, 3, 0]
        pools[t] = [t * 4 + n for n in copies]
    def allocate(text):
        return [pools[t].pop(0) for t in parse(text)]
    tiles = allocate(case['tiles'])
    win = next(t for t in tiles if t // 4 == parse(case['win'])[0])
    melds = []
    for m in case['melds']:
        ids = allocate(m['tiles'])
        tiles.extend(ids)
        kind = {'ankan': Meld.KAN, 'minkan': Meld.KAN, 'kakan': Meld.SHOUMINKAN}.get(m['type'], m['type'])
        melds.append(Meld(kind, ids, opened=m['type'] != 'ankan'))
    indicators = allocate(ctx.get('dora', ''))
    # 本库把有效里宝牌一并归入 Dora；映射时同样合并静态预期的宝牌/里宝牌。
    if ctx.get('riichi') or ctx.get('doubleRiichi'):
        indicators += allocate(ctx.get('uraDora', ''))
    tsumo = ctx['agariType'] == 'tsumo'
    config = HandConfig(
        is_tsumo=tsumo, is_riichi=ctx.get('riichi', False),
        is_daburu_riichi=ctx.get('doubleRiichi', False), is_ippatsu=ctx.get('ippatsu', False),
        is_haitei=ctx.get('haitei', False) and tsumo,
        is_houtei=ctx.get('haitei', False) and not tsumo,
        is_rinshan=ctx.get('rinshan', False), is_chankan=ctx.get('chankan', False),
        is_tenhou=ctx.get('tenhou', False), is_chiihou=ctx.get('chihou', False),
        player_wind=parse(ctx['jikaze'])[0], round_wind=parse(ctx['bakaze'])[0],
        options=OptionalRules(has_open_tanyao=True, has_aka_dora=bool(red), has_double_yakuman=True))
    result = HandCalculator().estimate_hand_value(tiles, win, melds, indicators, config)
    if result.error:
        return result, {}
    opened = any(m.opened for m in melds)
    actual_yaku = {}
    for y in result.yaku:
        value = y.han_open if opened else y.han_closed
        if not value:
            continue
        actual_yaku[names[type(y).__name__]] = value // 13 if y.is_yakuman else value
    return result, actual_yaku

def check(case):
    result, actual_yaku = evaluate(case)
    assert not result.error, result.error
    expected = case['expected']
    target = dict(expected.get('yakuman', expected['yaku']))
    if '里宝牌' in target:
        target['宝牌'] = target.get('宝牌', 0) + target.pop('里宝牌')
    assert actual_yaku == target, (actual_yaku, target)
    if 'yakuman' in expected:
        assert result.han == 13 * sum(target.values()), result.han
    else:
        assert (result.han, result.fu) == (expected['han'], expected['fu']), (result.han, result.fu)
        if 'rawFu' in expected:
            assert sum(d['fu'] for d in result.fu_details) == expected['rawFu'], result.fu_details

if __name__ == '__main__':
    failures = []
    for case in cases:
        try:
            check(case)
            print('PASS', case['id'], case['name'])
        except Exception as error:
            failures.append(case['id'])
            print('FAIL', case['id'], case['name'], repr(error))
    print(f'独立 mahjong 1.4.0 核对：{len(cases) - len(failures)}/{len(cases)} 通过')
    if '--report' in sys.argv:
        record = {
            'library': 'mahjong', 'libraryVersion': version('mahjong'),
            'checkedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            'casesSha256': hashlib.sha256((root / 'winning-hands.cases.js').read_bytes()).hexdigest(),
            'total': len(cases), 'passed': len(cases) - len(failures),
            'failed': len(failures), 'failedCaseIds': failures,
        }
        (root / 'winning-hands-oracle-result.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    raise SystemExit(bool(failures))
