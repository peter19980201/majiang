"""可选独立牌例核验，直接运行；缺 mahjong==1.4.0 会失败，不静默跳过。
复用既有独立Python核验的136牌适配，不使用项目JS计分器。
目标役与番数为人工固定预期，与页面定义的示例分离。
"""
import importlib.util
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('existing_oracle', root / 'winning-hands-oracle.py')
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
expected = {
    '立直': [1], '一发': [1], '门前清自摸和': [1], '平和': [1], '一杯口': [1], '断幺九': [1],
    '役牌:白': [1], '役牌:发': [1], '役牌:中': [1], '役牌:场风': [1], '役牌:自风': [1],
    '海底摸月': [1], '河底捞鱼': [1], '岭上开花': [1], '抢杠': [1], '双立直': [2],
    '七对子': [2], '三色同顺': [2], '一气通贯': [1], '混全带幺九': [2], '对对和': [2],
    '三暗刻': [2], '三色同刻': [2], '混老头': [2], '小三元': [2], '三杠子': [2],
    '二杯口': [3], '纯全带幺九': [3], '混一色': [3], '清一色': [6],
    '天和': [1], '地和': [1], '国士无双': [1, 2], '四暗刻': [1, 2],
    '大三元': [1], '字一色': [1], '绿一色': [1], '清老头': [1], '小四喜': [1],
    '大四喜': [2], '四杠子': [1], '九莲宝灯': [1, 2],
}
variants = {'国士无双': '国士无双十三面', '四暗刻': '四暗刻单骑', '九莲宝灯': '纯正九莲宝灯'}
examples = json.loads(subprocess.check_output(
    ['node', '-e', 'process.stdout.write(JSON.stringify(require("./utils/yaku-examples").examples))'], cwd=root.parent))
assert set(examples) == set(expected)
count = 0
for name, entries in examples.items():
    assert len(entries) == len(expected[name]), name
    for index, example in enumerate(entries):
        ctx = dict(example['context'])
        ctx['bakaze'] = '東南西北'[ctx['bakaze'] - 27]
        ctx['jikaze'] = '東南西北'[ctx['jikaze'] - 27]
        case = dict(tiles=example['hand'] + example['agari'], win=example['agari'], melds=example['melds'], context=ctx)
        result, yaku = oracle.evaluate(case)
        target = variants[name] if index else name
        assert not result.error, (target, result.error)
        assert yaku.get(target) == expected[name][index], (target, yaku)
        count += 1
        print('PASS', target)
assert count == 45
print('独立 mahjong 1.4.0 役种示例核验：45/45通过')
