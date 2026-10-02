"""固定随机种子生成扩展集。答案仅由 mahjong 1.4.0 生成，不读取项目引擎输出。
运行：/tmp/majiang-oracle-venv/bin/python test/generate-winning-hands.py
"""
import collections
import copy
import hashlib
import importlib.util
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('oracle', ROOT / 'winning-hands-oracle.py')
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
SEED = 20261002
rng = random.Random(SEED)
HONORS = '東南西北白发中'
YAO = [0, 8, 9, 17, 18, 26, *range(27, 34)]

def short(t):
    return str(t % 9 + 1) + 'mps'[t // 9] if t < 27 else HONORS[t - 27]

def text(tiles):
    return ''.join(short(t) for t in sorted(tiles))

def context(melds, hand, category):
    closed = all(m['type'] == 'ankan' for m in melds)
    kan = sum('kan' in m['type'] for m in melds)
    ctx = dict(agariType=rng.choice(['ron', 'tsumo']), bakaze=rng.choice('東南西北'), jikaze=rng.choice('東南西北'))
    if closed and category != 'kokushi':
        state = rng.randrange(5)
        if state in (1, 2): ctx['riichi'] = True
        if state == 3: ctx['doubleRiichi'] = True
        if state and (ctx.get('riichi') or ctx.get('doubleRiichi')) and rng.random() < .2:
            ctx['ippatsu'] = True
    event = rng.randrange(12)
    if event == 0: ctx['haitei'] = True
    if event == 1 and kan and ctx['agariType'] == 'tsumo': ctx['rinshan'] = True
    if ctx.get('rinshan'): ctx.pop('ippatsu', None)  # 开杠中断一发
    if event == 2 and category != 'kokushi' and ctx['agariType'] == 'ron': ctx['chankan'] = True
    # 天和/地和仅无杠门清自摸，且无立直或其他特殊事件。
    if event == 3 and not melds and ctx['agariType'] == 'tsumo':
        ctx = {k: ctx[k] for k in ['agariType', 'bakaze', 'jikaze']}
        ctx['tenhou' if ctx['jikaze'] == '東' else 'chihou'] = True
    occupied = collections.Counter(hand + [t for m in melds for t in oracle.parse(m['tiles'])])
    # 选择实际存在的指示牌，计入同一副136张牌的数量约束。
    n = rng.randrange(kan + 2)
    for key in ['dora', 'uraDora']:
        if key == 'uraDora' and not (ctx.get('riichi') or ctx.get('doubleRiichi')): continue
        indicators = []
        for _ in range(n):
            available = [t for t in range(34) if occupied[t] < 4]
            t = rng.choice(available)
            indicators.append(t)
            occupied[t] += 1
        ctx[key] = text(indicators)
    # 默认每种花色一张红五；四张同种五必然含一张红五。
    all_tiles = hand + [t for m in melds for t in oracle.parse(m['tiles'])]
    rd = {}
    for t, key in [(4, 'm5'), (13, 'p5'), (22, 's5')]:
        count = all_tiles.count(t)
        if count == 4 or count and rng.random() < .35: rd[key] = 1
    if rd: ctx['redDora'] = rd
    return ctx

def regular():
    pair = rng.randrange(34)
    hand = [pair, pair]
    melds = []
    mode = rng.randrange(4)
    suit = rng.randrange(3)
    for _ in range(4):
        seq = rng.random() < ([.8, .25, .55, .55][mode])
        if seq:
            start = (suit if mode == 3 else rng.randrange(3)) * 9 + rng.randrange(7)
            group = [start, start + 1, start + 2]
            kind = 'chi'
        else:
            t = (suit * 9 + rng.randrange(9)) if mode == 3 and rng.random() < .8 else rng.randrange(34)
            group = [t] * 3
            kind = 'pon'
        state = rng.randrange(5)
        if not seq and state == 0:
            group.append(group[0])
            kind = rng.choice(['ankan', 'minkan', 'kakan'])
            melds.append(dict(type=kind, tiles=text(group)))
        elif state == 1:
            melds.append(dict(type=kind, tiles=text(group)))
        else: hand += group
    return hand, melds

def candidate(category):
    source = None
    if category == 'regular': hand, melds = regular()
    elif category == 'seven-pairs':
        pool = list(range(34))
        if rng.random() < .4:
            suit = rng.randrange(3)
            pool = list(range(suit * 9, suit * 9 + 9)) + (list(range(27, 34)) if rng.random() < .5 else [])
        hand = [t for t in rng.sample(pool, 7) for _ in range(2)]
        melds = []
    elif category == 'high-fu':
        hand = oracle.parse(rng.choice(['234p678s55p', '999p234s55p']))
        melds = [dict(type='ankan', tiles='1111m'), dict(type='ankan', tiles='9999m')]
    elif category == 'kokushi':
        hand = YAO + [rng.choice(YAO)]
        melds = []
    else:
        seed = rng.choice(oracle.cases)
        source = seed['id']
        hand = oracle.parse(seed['tiles'])
        melds = copy.deepcopy(seed['melds'])
    all_tiles = hand + [t for m in melds for t in oracle.parse(m['tiles'])]
    if max(collections.Counter(all_tiles).values()) > 4: return None
    ctx = context(melds, hand, category)
    return dict(name=category, category=category, sourceCase=source,
                tiles=text(hand), win=short(rng.choice(hand)), melds=melds, context=ctx)

records, seen = [], set()
for category, quota in [('regular', 3450), ('seven-pairs', 700), ('kokushi', 300), ('reference-variants', 1500), ('high-fu', 50)]:
    accepted = 0
    attempts = 0
    while accepted < quota:
        attempts += 1
        assert attempts < quota * 100, '生成次数超过上限'
        c = candidate(category)
        if not c: continue
        identity = json.dumps({k: c[k] for k in ['tiles', 'win', 'melds', 'context']}, sort_keys=True)
        if identity in seen: continue
        result, yaku = oracle.evaluate(c)
        if result.error:
            assert result.error == 'no_yaku', (c, result.error)
            expected = dict(error='无成立役种', oracleError=result.error)
        elif any(y.is_yakuman for y in result.yaku):
            expected = dict(han=None, fu=None, yaku={}, yakuman=yaku, parts='役满不计番符')
        else:
            # 独立库把里宝牌合并至Dora；拆回项目的两个显示条目。
            ura = 0
            if c['context'].get('riichi') or c['context'].get('doubleRiichi'):
                for indicator in oracle.parse(c['context'].get('uraDora', '')):
                    if indicator < 27: target = indicator // 9 * 9 + (indicator % 9 + 1) % 9
                    elif indicator < 31: target = 27 + (indicator - 27 + 1) % 4
                    else: target = 31 + (indicator - 31 + 1) % 3
                    ura += (oracle.parse(c['tiles']) + [t for m in c['melds'] for t in oracle.parse(m['tiles'])]).count(target)
            if ura:
                yaku['宝牌'] -= ura
                if not yaku['宝牌']: del yaku['宝牌']
                yaku['里宝牌'] = ura
            expected = dict(han=result.han, fu=result.fu, yaku=yaku,
                            parts=result.fu_details)
        c['id'] = f'G{len(records) + 1:05}'
        c['expected'] = expected
        records.append(c)
        seen.add(identity)
        accepted += 1
    print(category, accepted, flush=True)

out = ROOT / 'fixtures' / 'winning-hands.generated.jsonl'
blob = ''.join(json.dumps(c, ensure_ascii=False, separators=(',', ':')) + '\n' for c in records).encode()
out.write_bytes(blob)
manifest = dict(seed=SEED, total=len(records), library='mahjong', libraryVersion='1.4.0',
                expectedSource='Independent Python library, not project engine',
                sha256=hashlib.sha256(blob).hexdigest(),
                generatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                adapterSha256=hashlib.sha256((ROOT / 'winning-hands-oracle.py').read_bytes()).hexdigest(),
                categories=dict(collections.Counter(c['category'] for c in records)),
                outcomes=dict(collections.Counter('no-yaku' if c['expected'].get('error') else 'yakuman' if c['expected'].get('yakuman') else 'normal' for c in records)))
(ROOT / 'fixtures' / 'winning-hands.generated.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
