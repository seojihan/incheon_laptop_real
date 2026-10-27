from __future__ import annotations

import math
import shutil
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
VIDEO = OUTPUT / "인천중산고_노트북_포털_광고영상.mp4"
POSTER = OUTPUT / "인천중산고_노트북_포털_광고영상_포스터.png"
SUBTITLES = OUTPUT / "인천중산고_노트북_포털_광고영상.srt"
NARRATION = OUTPUT / "인천중산고_노트북_포털_광고영상_대본.txt"
MUSIC = Path(r"C:\Users\admin\Downloads\Lets go back - Patrick Patrikios.mp3")

INPUTS = {
    "guide": Path(r"C:\Users\admin\Pictures\Screenshots\스크린샷 2026-10-25 164254.png"),
    "home_rental": Path(r"C:\Users\admin\Pictures\Screenshots\스크린샷 2026-10-25 164231.png"),
    "home": Path(r"C:\Users\admin\Pictures\Screenshots\스크린샷 2026-10-25 164145.png"),
    "class": Path(r"C:\Users\admin\Pictures\Screenshots\스크린샷 2026-10-25 164223.png"),
    "login": Path(r"C:\Users\admin\Pictures\Screenshots\스크린샷 2026-10-25 164041.png"),
}

W, H, FPS = 1920, 1080, 24
DURATION = 56
SCENE_LENGTHS = [8, 6, 6, 7, 7, 5, 11, 6]
SCENE_STARTS = [0]
for length in SCENE_LENGTHS[:-1]:
    SCENE_STARTS.append(SCENE_STARTS[-1] + length)
TRANSITION = 0.42

BG = (249, 247, 240)
PAPER = (244, 240, 229)
WHITE = (255, 255, 252)
INK = (37, 55, 44)
FOREST = (36, 60, 45)
MOSS = (79, 112, 84)
PALE = (226, 237, 222)
GOLD = (201, 158, 76)
GOLD_PALE = (247, 238, 216)
MUTED = (109, 113, 102)
LINE = (225, 221, 209)
BLUE = (85, 125, 137)
BLUE_PALE = (229, 238, 239)
RED = (168, 92, 70)
RED_PALE = (246, 231, 222)

FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"
FONT_BOLD_PATH = r"C:\Windows\Fonts\malgunbd.ttf"
FONT_22 = ImageFont.truetype(FONT_PATH, 22)
FONT_24B = ImageFont.truetype(FONT_BOLD_PATH, 24)
FONT_28 = ImageFont.truetype(FONT_PATH, 28)
FONT_30B = ImageFont.truetype(FONT_BOLD_PATH, 30)

CAPTIONS = [
    "학교 노트북 관리 웹사이트. 교과·가정 대여 신청부터 승인, 배정, 반납 확인까지 한곳에서.",
    "학교 계정으로 접속해 학생·선생님·관리 도우미별로 필요한 메뉴를 이용합니다.",
    "교과 대여, 가정 대여, 신청 기록을 홈 화면에서 바로 확인할 수 있습니다.",
    "교과 대여는 연도와 주차를 고르고, 요일과 필요한 교시를 선택해 신청합니다.",
    "가정 대여는 필요한 기간과 사용 목적을 입력하고, 반출 수칙을 확인해 신청합니다.",
    "단계별 이용 안내에서 신청부터 기기 수령, 안전한 반납까지 살펴볼 수 있습니다.",
    "담당자는 신청을 검토하고 승인·반려합니다. 승인된 노트북은 자동 배정되며, 알림과 기록에서 상태와 반납을 확인합니다.",
    "인천중산고등학교 노트북 포털. 개발 서지한 · 이주진.",
]

NARRATION_LINES = [
    "학교 노트북 관리 웹사이트. 교과·가정 대여 신청부터 승인, 기기 배정과 반납 확인까지 한곳에서 관리합니다.",
    "인천중산고 노트북 포털은 학교 계정으로 접속하며, 학생과 담당자에게 필요한 메뉴와 기능을 제공합니다.",
    "학교 계정으로 로그인하면 역할에 맞는 메뉴가 보이고, 학생은 대여 신청과 내 기록으로 바로 이동할 수 있습니다.",
    "교과 대여는 연도와 주차, 요일, 필요한 교시를 선택해 수업 시간에 맞춰 신청합니다.",
    "가정 대여는 필요한 기간과 사용 목적을 입력하고, 학교의 반출 수칙을 확인해 접수합니다.",
    "이용 안내에서 신청부터 기기 수령, 안전한 반납까지 단계별로 확인할 수 있습니다.",
    "담당자는 신청을 승인하거나 반려합니다. 승인된 신청에는 사용 가능한 노트북이 자동 배정됩니다. 알림과 기록, 재고 화면에서 현재 상태와 반납을 이어서 관리합니다.",
    "신청은 간편하게, 관리는 명확하게. 인천중산고등학교 노트북 포털. 개발 서지한, 이주진.",
]


def clamp(value: float, lo: float = 0, hi: float = 1) -> float:
    return max(lo, min(hi, value))


def ease(value: float) -> float:
    p = clamp(value)
    return p * p * (3 - 2 * p)


def mix(a, b, p: float):
    return tuple(round(a[i] + (b[i] - a[i]) * p) for i in range(3))


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD_PATH if bold else FONT_PATH, size)


def background() -> Image.Image:
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line((0, y, W, y), fill=mix((251, 249, 243), (239, 237, 226), y / (H - 1)))
    d.ellipse((1280, -450, 2110, 380), fill=(245, 240, 225))
    d.ellipse((-440, 670, 320, 1430), fill=(238, 241, 231))
    d.arc((1160, 320, 2010, 1170), 210, 335, fill=(230, 226, 212), width=2)
    d.arc((1225, 385, 1940, 1100), 210, 335, fill=(235, 231, 220), width=2)
    return img


BG_IMAGE = background()


def make_laptop_mark(size: int, bg=FOREST) -> Image.Image:
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(icon)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.24), fill=bg)
    line = max(3, size // 20)
    d.rounded_rectangle((size * .27, size * .20, size * .73, size * .62), radius=size * .055, outline=WHITE, width=line)
    d.line((size * .20, size * .72, size * .80, size * .72), fill=WHITE, width=line)
    d.line((size * .27, size * .64, size * .20, size * .72), fill=WHITE, width=line)
    d.line((size * .73, size * .64, size * .80, size * .72), fill=WHITE, width=line)
    return icon


LOGO = make_laptop_mark(168)
SMALL_LOGO = make_laptop_mark(52)


def draw_brand(d: ImageDraw.ImageDraw):
    d.rounded_rectangle((104, 58, 156, 110), radius=16, fill=FOREST)
    d.line((117, 78, 143, 78), fill=WHITE, width=3)
    d.rounded_rectangle((119, 68, 141, 84), radius=3, outline=WHITE, width=2)
    d.polygon([(114, 88), (146, 88), (142, 93), (118, 93)], fill=WHITE)
    d.text((171, 60), "인천중산고", font=FONT_24B, fill=INK)
    d.text((171, 87), "노트북 포털", font=font(17), fill=MUTED)
    d.line((104, 133, 1815, 133), fill=(225, 221, 210), width=1)
    d.text((1574, 74), "학교 노트북 대여 관리", font=font(17), fill=MUTED)


def draw_caption(d: ImageDraw.ImageDraw, text: str):
    d.rounded_rectangle((104, 902, 1816, 991), radius=24, fill=FOREST)
    d.rounded_rectangle((132, 930, 139, 963), radius=3, fill=GOLD)
    lines = textwrap.wrap(text, width=54)
    if len(lines) > 2:
        lines = lines[:2]
    d.multiline_text((167, 919), "\n".join(lines), font=font(25), fill=WHITE, spacing=8)


def draw_progress(d: ImageDraw.ImageDraw, t: float):
    x, y, w = 104, 1030, 1712
    d.rounded_rectangle((x, y, x + w, y + 5), radius=3, fill=(218, 216, 205))
    p = clamp(t / DURATION)
    d.rounded_rectangle((x, y, x + round(w * p), y + 5), radius=3, fill=MOSS)
    for start in SCENE_STARTS:
        xx = x + round(w * start / DURATION)
        d.ellipse((xx - 5, y - 4, xx + 5, y + 9), fill=GOLD if abs(t - start) < 0.7 else (204, 200, 187))


def draw_label(d: ImageDraw.ImageDraw, x: int, y: int, text: str, fill=PALE, color=FOREST, f=None):
    f = f or font(18)
    bbox = d.textbbox((0, 0), text, font=f)
    width = bbox[2] - bbox[0] + 32
    height = bbox[3] - bbox[1] + 20
    d.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=fill)
    d.text((x + 16, y + 8 - bbox[1]), text, font=f, fill=color)
    return width, height


def draw_title(d: ImageDraw.ImageDraw, kicker: str, title: str, body: str, y=216):
    draw_label(d, 124, y, kicker)
    d.multiline_text((124, y + 70), title, font=font(63, True), fill=INK, spacing=16)
    body_y = y + 70 + (title.count("\n") + 1) * 79 + 24
    d.multiline_text((129, body_y), body, font=font(27), fill=MUTED, spacing=12)


def round_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_screen(canvas: Image.Image, key: str, bounds, zoom=1.0, pan_x=0.0, pan_y=0.0, label_text="실제 서비스 화면"):
    x0, y0, x1, y1 = bounds
    w, h = x1 - x0, y1 - y0
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((x0 + 10, y0 + 14, x1 + 10, y1 + 14), radius=26, fill=(219, 216, 206))
    d.rounded_rectangle((x0, y0, x1, y1), radius=26, fill=WHITE, outline=(224, 220, 209), width=2)
    pad = 13
    inner = (w - 2 * pad, h - 2 * pad)
    source = SCREEN_IMAGES[key]
    scale = min(inner[0] / source.width, inner[1] / source.height) * zoom
    resized = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.LANCZOS)
    crop_w, crop_h = min(resized.width, inner[0]), min(resized.height, inner[1])
    crop_x = round((resized.width - crop_w) * clamp(0.5 + pan_x))
    crop_y = round((resized.height - crop_h) * clamp(0.5 + pan_y))
    image = resized.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
    ix = x0 + pad + (inner[0] - image.width) // 2
    iy = y0 + pad + (inner[1] - image.height) // 2
    canvas.paste(image, (ix, iy), round_mask(image.size, 14))
    if label_text:
        label_y = max(144, y0 - 47)
        draw_label(d, x0 + 6, label_y, label_text, fill=WHITE, color=MUTED, f=font(15))


def draw_callout(d: ImageDraw.ImageDraw, box, title: str, body: str, accent=MOSS):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0 + 4, y0 + 7, x1 + 4, y1 + 7), radius=20, fill=(227, 224, 215))
    d.rounded_rectangle((x0, y0, x1, y1), radius=20, fill=WHITE, outline=LINE, width=1)
    d.rounded_rectangle((x0 + 18, y0 + 18, x0 + 52, y0 + 52), radius=11, fill=PALE if accent == MOSS else GOLD_PALE)
    d.ellipse((x0 + 29, y0 + 29, x0 + 41, y0 + 41), fill=accent)
    d.text((x0 + 67, y0 + 20), title, font=font(22, True), fill=INK)
    d.multiline_text((x0 + 22, y0 + 72), body, font=font(18), fill=MUTED, spacing=7)


def draw_check(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill=MOSS):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
    d.line((cx - r * .43, cy, cx - r * .08, cy + r * .34), fill=WHITE, width=max(2, r // 4))
    d.line((cx - r * .08, cy + r * .34, cx + r * .48, cy - r * .42), fill=WHITE, width=max(2, r // 4))


def draw_helper(d: ImageDraw.ImageDraw, x: int, y: int, shirt, hair, side="left", local=0.0):
    # x is the center of the helper; y is the desk line.
    head_y = y - 196
    skin = (226, 188, 151)
    d.rounded_rectangle((x - 73, y - 150, x + 73, y + 86), radius=48, fill=shirt)
    d.rounded_rectangle((x - 16, head_y + 92, x + 16, head_y + 137), radius=12, fill=skin)
    d.ellipse((x - 58, head_y, x + 58, head_y + 119), fill=skin)
    d.pieslice((x - 62, head_y - 7, x + 62, head_y + 84), 185, 355, fill=hair)
    d.ellipse((x - 54, head_y + 35, x - 40, head_y + 70), fill=hair)
    d.ellipse((x + 39, head_y + 37, x + 53, head_y + 70), fill=hair)
    d.ellipse((x - 25, head_y + 57, x - 18, head_y + 64), fill=INK)
    d.ellipse((x + 17, head_y + 57, x + 24, head_y + 64), fill=INK)
    d.arc((x - 16, head_y + 67, x + 17, head_y + 94), 15, 165, fill=(145, 82, 67), width=3)
    # Lanyard and helper badge.
    d.line((x - 19, y - 132, x, y - 96, x + 19, y - 132), fill=GOLD_PALE, width=5)
    d.rounded_rectangle((x - 24, y - 100, x + 24, y - 71), radius=7, fill=(252, 246, 229))
    d.text((x - 17, y - 96), "도우미", font=font(12, True), fill=FOREST)
    # Writing arm and pencil animate over the paper.
    arm_offset = math.sin(local * 5 + (0 if side == "left" else 1.8)) * 4
    start = (x - 50 if side == "left" else x + 48, y - 85)
    hand = (x + 86 + arm_offset, y - 12)
    d.line((start, hand), fill=shirt, width=27)
    d.ellipse((hand[0] - 13, hand[1] - 11, hand[0] + 13, hand[1] + 11), fill=skin)
    d.line((hand[0] - 28, hand[1] - 16, hand[0] + 23, hand[1] + 8), fill=(196, 154, 99), width=6)
    d.polygon([(hand[0] + 23, hand[1] + 8), (hand[0] + 32, hand[1] + 11), (hand[0] + 25, hand[1] + 1)], fill=INK)


def draw_ledger(d: ImageDraw.ImageDraw, x: int, y: int, w=250, h=146, page=0):
    d.rounded_rectangle((x + 8, y + 10, x + w + 8, y + h + 10), radius=10, fill=(176, 156, 126))
    d.rounded_rectangle((x, y, x + w, y + h), radius=10, fill=(255, 253, 246), outline=(212, 199, 175), width=2)
    d.rectangle((x + 1, y + 1, x + w - 1, y + 27), fill=(236, 226, 207))
    d.text((x + 15, y + 5), "노트북 대여 기록", font=font(14, True), fill=INK)
    d.line((x + 18, y + 40, x + w - 18, y + 40), fill=(214, 205, 187), width=1)
    for row in range(4):
        yy = y + 58 + row * 20
        d.line((x + 18, yy, x + w - 18, yy), fill=(227, 220, 204), width=1)
        for col, xx in enumerate((x + 26, x + 105, x + 183)):
            span = 38 if col != 1 else 50
            left = xx + ((row * 11 + page * 5) % 12)
            d.line((left, yy - 8, min(x + w - 18, left + span), yy - 3), fill=(91, 110, 84), width=2)


def draw_intro_scene(img: Image.Image, t: float):
    d = ImageDraw.Draw(img)
    draw_label(d, 124, 176, "학교 노트북 관리 웹사이트")
    d.multiline_text((124, 246), "대여 신청부터\n반납 확인까지 한곳에서.", font=font(58, True), fill=INK, spacing=13)
    d.text((128, 425), "교과·가정 대여와 승인, 기기 배정, 이용 기록을 간편하게", font=font(23), fill=MUTED)

    # A clean, progressive flow introduces the core of the portal in the same visual language as the closing infographic.
    card = (124, 520, 1796, 846)
    d.rounded_rectangle((card[0] + 5, card[1] + 9, card[2] + 5, card[3] + 9), radius=30, fill=(229, 226, 216))
    d.rounded_rectangle(card, radius=30, fill=WHITE, outline=LINE, width=1)
    d.text((166, 554), "ONE PORTAL · CLEAR STATUS", font=font(15, True), fill=MOSS)
    d.text((1754, 554), "학교 계정으로 시작", font=font(16), fill=MUTED, anchor="ra")

    xs = [310, 745, 1180, 1615]
    cy = 670
    progress = ease(t / 7.4)
    d.line((xs[0], cy, xs[-1], cy), fill=(218, 221, 211), width=8)
    d.line((xs[0], cy, xs[0] + (xs[-1] - xs[0]) * progress, cy), fill=MOSS, width=8)
    nodes = [
        ("대여 유형 선택", "교과 대여 · 가정 대여"),
        ("간편한 신청", "기간과 수업에 맞춰 신청"),
        ("승인 · 기기 배정", "담당자 검토 후 배정"),
        ("기록 · 반납 확인", "알림과 기록에서 상태 확인"),
    ]
    for i, (title, body) in enumerate(nodes):
        active = progress >= i / (len(nodes) - 1)
        fill = MOSS if active else WHITE
        icon_color = WHITE if active else MOSS
        d.ellipse((xs[i] - 44, cy - 44, xs[i] + 44, cy + 44), fill=fill, outline=MOSS if active else (211, 214, 203), width=3)
        if i == 0:
            d.rounded_rectangle((xs[i] - 18, cy - 20, xs[i] + 18, cy + 19), radius=5, outline=icon_color, width=3)
            d.line((xs[i] - 17, cy - 8, xs[i] + 17, cy - 8), fill=icon_color, width=3)
            d.line((xs[i] - 8, cy - 24, xs[i] - 8, cy - 15), fill=icon_color, width=3)
            d.line((xs[i] + 8, cy - 24, xs[i] + 8, cy - 15), fill=icon_color, width=3)
        elif i == 1:
            d.rounded_rectangle((xs[i] - 19, cy - 20, xs[i] + 19, cy + 11), radius=4, outline=icon_color, width=3)
            d.polygon([(xs[i] - 27, cy + 18), (xs[i] + 27, cy + 18), (xs[i] + 20, cy + 24), (xs[i] - 20, cy + 24)], fill=icon_color)
        elif i == 2:
            d.line((xs[i] - 19, cy, xs[i] - 5, cy + 15, xs[i] + 23, cy - 17), fill=icon_color, width=5, joint="curve")
        else:
            d.rounded_rectangle((xs[i] - 18, cy - 22, xs[i] + 18, cy + 22), radius=4, outline=icon_color, width=3)
            d.line((xs[i] - 9, cy - 8, xs[i] + 9, cy - 8), fill=icon_color, width=2)
            d.line((xs[i] - 9, cy, xs[i] + 9, cy), fill=icon_color, width=2)
            d.line((xs[i] - 9, cy + 8, xs[i] + 4, cy + 8), fill=icon_color, width=2)
        title_box = d.textbbox((0, 0), title, font=font(20, True))
        d.text((xs[i] - (title_box[2] - title_box[0]) / 2, 739), title, font=font(20, True), fill=INK if active else MUTED)
        body_box = d.textbbox((0, 0), body, font=font(15))
        d.text((xs[i] - (body_box[2] - body_box[0]) / 2, 776), body, font=font(15), fill=MUTED)


def draw_problem_scene(img: Image.Image, t: float):
    d = ImageDraw.Draw(img)
    # School office window and bright morning light.
    d.rounded_rectangle((1060, 172, 1780, 576), radius=24, fill=(235, 237, 226), outline=(225, 222, 211), width=2)
    d.line((1420, 177, 1420, 572), fill=WHITE, width=13)
    d.line((1065, 360, 1775, 360), fill=WHITE, width=13)
    d.ellipse((1480, 210, 1640, 370), fill=(246, 237, 210))
    # Desk and two helpers.
    d.rounded_rectangle((210, 630, 1710, 798), radius=28, fill=(182, 144, 99))
    d.rounded_rectangle((210, 610, 1710, 664), radius=22, fill=(207, 174, 128))
    d.rectangle((290, 780, 360, 882), fill=(157, 124, 87))
    d.rectangle((1560, 780, 1630, 882), fill=(157, 124, 87))
    draw_helper(d, 700, 629, (82, 116, 86), (56, 45, 38), "left", t)
    draw_helper(d, 1240, 629, (78, 106, 127), (47, 40, 37), "right", t)
    draw_ledger(d, 840, 552, 300, 155, round(t))
    # A neat stack of paper requests and a storage laptop on the desk.
    for i in range(4):
        y = 565 - i * 8
        d.rounded_rectangle((425 + i * 4, y, 590 + i * 4, y + 100), radius=8, fill=(255, 253, 246), outline=(223, 216, 199), width=2)
    d.text((442, 584), "신청서", font=font(16, True), fill=MUTED)
    d.line((443, 617, 561, 617), fill=(218, 213, 201), width=2)
    d.line((443, 639, 543, 639), fill=(218, 213, 201), width=2)
    # Device shelf represented with a few laptop silhouettes.
    d.rounded_rectangle((1458, 548, 1647, 629), radius=15, fill=(232, 236, 224))
    for i in range(3):
        xx = 1478 + i * 54
        d.rounded_rectangle((xx, 564, xx + 38, 592), radius=5, fill=FOREST)
        d.rounded_rectangle((xx + 4, 568, xx + 34, 587), radius=3, fill=(245, 245, 237))
        d.polygon([(xx - 4, 596), (xx + 43, 596), (xx + 37, 602), (xx + 2, 602)], fill=(146, 157, 143))
    # Problem labels appear after the handwritten routine has been established.
    if t > 2.4:
        alpha = ease((t - 2.4) / 0.8)
        labels = [
            ((356, 465, 585, 520), "신청서를 다시 확인"),
            ((1253, 450, 1477, 505), "반납 상태를 찾아보기"),
        ]
        for box, text in labels:
            x0, y0, x1, y1 = box
            d.rounded_rectangle(box, radius=18, fill=(255, 255, 252))
            d.ellipse((x0 + 14, y0 + 16, x0 + 34, y0 + 36), fill=GOLD_PALE)
            d.text((x0 + 21, y0 + 14), "!", font=font(17, True), fill=GOLD)
            d.text((x0 + 44, y0 + 15), text, font=font(16, True), fill=INK)
    # The headline and opening context.
    draw_label(d, 124, 170, "수기 기록에서 시작된 변화", fill=PALE, color=FOREST)
    d.multiline_text((124, 242), "신청도, 반납도\n장부에 한 줄씩.", font=font(62, True), fill=INK, spacing=14)
    d.text((130, 428), "두 명의 노트북 관리 도우미가", font=font(25, True), fill=FOREST)
    d.text((130, 466), "대여 현황을 직접 기록했습니다.", font=font(25), fill=MUTED)


def draw_screen_scene(img: Image.Image, index: int, t: float):
    d = ImageDraw.Draw(img)
    scenes = {
        1: ("직접 개발한 학교 포털", "대여 업무를\n한곳에서 관리.", "인천중산고 노트북 포털은 학교 계정으로 이용합니다.", "login", (732, 190, 1782, 833)),
        2: ("간편한 시작 화면", "필요한 기능으로\n바로 이동.", "교과 대여 · 가정 대여 · 신청 기록을 한눈에.", "home", (652, 185, 1788, 829)),
        3: ("STEP 01 · 교과 대여", "필요한 교시만\n골라서 신청.", "연도와 주차를 고른 뒤, 요일과 교시를 선택하세요.", "class", (756, 157, 1453, 846)),
        4: ("STEP 02 · 가정 대여", "학습이 이어질\n기간을 선택.", "대여 기간과 목적을 입력하고, 반출 수칙을 확인합니다.", "home_rental", (694, 176, 1778, 837)),
        5: ("처음 이용해도 쉽게", "단계별 이용\n안내를 확인.", "로그인 전 준비부터 신청, 안전한 반납까지 살펴보세요.", "guide", (666, 171, 1432, 842)),
    }
    kicker, title, body, key, box = scenes[index]
    # Title column has one clear idea and two brief lines.
    x = 122
    y = 245 if index in (3, 4, 5) else 254
    draw_label(d, x, y, kicker)
    d.multiline_text((x, y + 70), title, font=font(55, True), fill=INK, spacing=13)
    body_y = y + 214
    d.multiline_text((x + 3, body_y), body, font=font(23), fill=MUTED, spacing=10)
    if index == 3:
        for i, (a, b) in enumerate((("01", "주차 선택"), ("02", "요일 선택"), ("03", "교시 선택"))):
            yy = 588 + i * 61
            d.ellipse((x + 2, yy, x + 35, yy + 33), fill=GOLD_PALE if i == 2 else PALE)
            d.text((x + 8, yy + 7), a, font=font(13, True), fill=GOLD if i == 2 else MOSS)
            d.text((x + 48, yy + 2), b, font=font(21, True), fill=INK)
    elif index == 4:
        draw_callout(d, (x, 599, x + 428, 704), "최대 30일", "대여 기간을 선택하고\n사용 목적을 적어 신청", accent=GOLD)
    elif index == 5:
        draw_callout(d, (x, 601, x + 428, 707), "안전한 반납", "담당자에게 직접 전달하고\n기록에서 완료를 확인", accent=MOSS)
    local_anim = ease(t / 2.0)
    zoom = 1.0 + 0.025 * local_anim
    pan_y = 0.03 * math.sin(t * 0.8)
    paste_screen(img, key, box, zoom=zoom, pan_y=pan_y)
    d = ImageDraw.Draw(img)
    if index == 2:
        # Highlight the portal's three main destinations without obscuring the capture.
        draw_label(d, 1190, 841, "교과 대여", fill=PALE, color=FOREST, f=font(15))
        draw_label(d, 1320, 841, "가정 대여", fill=GOLD_PALE, color=GOLD, f=font(15))
        draw_label(d, 1450, 841, "신청 기록", fill=BLUE_PALE, color=BLUE, f=font(15))


def draw_infographic(img: Image.Image, t: float):
    d = ImageDraw.Draw(img)
    draw_label(d, 124, 176, "그 밖의 기능")
    d.text((124, 246), "신청 이후까지,\n하나의 흐름으로.", font=font(58, True), fill=INK, spacing=14)
    d.text((128, 423), "담당자 승인부터 기기 배정과 반납 확인까지", font=font(24), fill=MUTED)
    # Main process line: the green trace advances over the scene.
    x0, x1, cy = 182, 1738, 608
    d.line((x0, cy, x1, cy), fill=(215, 218, 207), width=8)
    progress = ease(t / 8.5)
    d.line((x0, cy, x0 + (x1 - x0) * progress, cy), fill=MOSS, width=8)
    nodes = [
        ("신청 접수", "학생이 신청"),
        ("담당자 검토", "승인 · 반려"),
        ("기기 배정", "사용 가능한 기기"),
        ("알림 · 기록", "상태와 번호 확인"),
        ("반납 확인", "완료 기록"),
    ]
    for i, (title, body) in enumerate(nodes):
        x = x0 + i * ((x1 - x0) // 4)
        active = progress >= i / 4
        fill = MOSS if active else WHITE
        d.ellipse((x - 46, cy - 46, x + 46, cy + 46), fill=fill, outline=MOSS if active else (209, 211, 200), width=3)
        if i == 0:
            d.rounded_rectangle((x - 17, cy - 18, x + 17, cy + 18), radius=5, outline=WHITE if active else MOSS, width=4)
            d.line((x - 11, cy - 6, x + 11, cy - 6), fill=WHITE if active else MOSS, width=3)
            d.line((x - 11, cy + 5, x + 8, cy + 5), fill=WHITE if active else MOSS, width=3)
        elif i == 1:
            draw_check(d, x, cy, 19, fill=GOLD if active else MOSS)
        elif i == 2:
            d.rounded_rectangle((x - 20, cy - 22, x + 20, cy + 12), radius=5, outline=WHITE if active else MOSS, width=4)
            d.polygon([(x - 28, cy + 18), (x + 28, cy + 18), (x + 21, cy + 25), (x - 21, cy + 25)], fill=WHITE if active else MOSS)
        elif i == 3:
            d.arc((x - 18, cy - 20, x + 18, cy + 16), 200, 340, fill=WHITE if active else MOSS, width=4)
            d.line((x + 15, cy - 20, x + 23, cy - 20, x + 23, cy - 12), fill=WHITE if active else MOSS, width=4)
        else:
            d.line((x - 20, cy, x - 5, cy + 15, x + 24, cy - 18), fill=WHITE if active else MOSS, width=5, joint="curve")
        label_color = INK if active else MUTED
        bbox = d.textbbox((0, 0), title, font=font(23, True))
        d.text((x - (bbox[2] - bbox[0]) / 2, cy + 67), title, font=font(23, True), fill=label_color)
        bbox = d.textbbox((0, 0), body, font=font(17))
        d.text((x - (bbox[2] - bbox[0]) / 2, cy + 101), body, font=font(17), fill=MUTED)
    # Role cards appear as the line reaches the last stages.
    cards = [
        ("학생", "교과·가정 대여 신청\n내 신청 기록 확인", PALE, MOSS),
        ("도우미", "담당 범위 신청 검토\n장비·반납 상태 확인", GOLD_PALE, GOLD),
        ("교사·관리자", "승인 관리와 재고 확인\n역할별 메뉴 제공", BLUE_PALE, BLUE),
    ]
    card_y = 760
    card_w = 496
    gap = 26
    for i, (role, body, fill, accent) in enumerate(cards):
        x = 144 + i * (card_w + gap)
        reveal = ease((t - 3.0 - i * .45) / 1.0)
        if reveal <= 0:
            continue
        yy = card_y + round(18 * (1 - reveal))
        d.rounded_rectangle((x, yy, x + card_w, yy + 110), radius=20, fill=WHITE, outline=LINE, width=1)
        d.rounded_rectangle((x + 19, yy + 17, x + 68, yy + 66), radius=15, fill=fill)
        d.ellipse((x + 35, yy + 33, x + 52, yy + 50), fill=accent)
        d.text((x + 85, yy + 18), role, font=font(23, True), fill=INK)
        d.multiline_text((x + 85, yy + 51), body, font=font(17), fill=MUTED, spacing=4)


def draw_closing(img: Image.Image, t: float):
    d = ImageDraw.Draw(img)
    # Richer forest-green close with a warm, quiet halo.
    for y in range(H):
        color = mix((43, 70, 52), (28, 48, 37), y / H)
        d.line((0, y, W, y), fill=color)
    d.ellipse((735, 96, 1185, 546), fill=(48, 79, 59))
    d.ellipse((790, 151, 1130, 491), outline=(87, 118, 88), width=2)
    d.ellipse((850, 211, 1070, 431), outline=(111, 138, 104), width=2)
    icon = LOGO.resize((168, 168), Image.Resampling.LANCZOS)
    img.paste(icon, (876, 220), icon)
    d.text((960, 463), "인천중산고등학교", font=font(54, True), fill=WHITE, anchor="mm")
    d.text((960, 530), "중산고 노트북 포털", font=font(27), fill=(220, 231, 215), anchor="mm")
    d.rounded_rectangle((730, 603, 1190, 674), radius=35, fill=(52, 80, 58), outline=(112, 143, 111), width=1)
    d.text((960, 638), "개발  서지한 · 이주진", font=font(27, True), fill=WHITE, anchor="mm")
    d.line((760, 739, 1160, 739), fill=(93, 121, 93), width=1)
    d.text((960, 778), "BGM  ·  Let’s go back — Patrick Patrikios", font=font(17), fill=(194, 207, 190), anchor="mm")
    d.text((960, 866), "신청은 간편하게, 관리는 명확하게.", font=font(26), fill=(226, 234, 221), anchor="mm")


def draw_scene(index: int, local: float, absolute: float) -> Image.Image:
    img = BG_IMAGE.copy()
    d = ImageDraw.Draw(img)
    draw_brand(d)
    if index == 0:
        draw_intro_scene(img, local)
    elif index in (1, 2, 3, 4, 5):
        draw_screen_scene(img, index, local)
    elif index == 6:
        draw_infographic(img, local)
    else:
        draw_closing(img, local)
    d = ImageDraw.Draw(img)
    draw_caption(d, CAPTIONS[index])
    draw_progress(d, absolute)
    return img


def scene_for_time(t: float):
    for i, start in enumerate(SCENE_STARTS):
        end = start + SCENE_LENGTHS[i]
        if t < end or i == len(SCENE_STARTS) - 1:
            return i, max(0.0, t - start)
    return len(SCENE_STARTS) - 1, 0.0


def make_frame(t: float) -> Image.Image:
    index, local = scene_for_time(t)
    current = draw_scene(index, local, t)
    if index > 0 and local < TRANSITION:
        previous_index = index - 1
        prev_local = SCENE_LENGTHS[previous_index] - TRANSITION + local
        previous = draw_scene(previous_index, prev_local, t)
        if index == 1:
            p = clamp(local / TRANSITION)
            if p < 0.5:
                return Image.blend(previous, BG_IMAGE, ease(p * 2))
            return Image.blend(BG_IMAGE, current, ease((p - 0.5) * 2))
        return Image.blend(previous, current, ease(local / TRANSITION))
    if index == 0 and local < TRANSITION:
        return Image.blend(BG_IMAGE, current, ease(local / TRANSITION))
    return current


def srt_time(seconds: float) -> str:
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def write_text_assets():
    entries = []
    for i, caption in enumerate(CAPTIONS):
        start = SCENE_STARTS[i]
        end = start + SCENE_LENGTHS[i]
        entries.extend([str(i + 1), f"{srt_time(start)} --> {srt_time(end)}", caption, ""])
    SUBTITLES.write_text("\n".join(entries), encoding="utf-8-sig")
    NARRATION.write_text("\n\n".join(NARRATION_LINES) + "\n", encoding="utf-8-sig")


def load_screens():
    images = {}
    for key, path in INPUTS.items():
        if not path.exists():
            raise FileNotFoundError(path)
        image = Image.open(path).convert("RGB")
        if key == "home_rental":
            # Hide the example student number while retaining the real form layout.
            ImageDraw.Draw(image).rectangle((270, 178, 341, 196), fill=(250, 248, 242))
        images[key] = image
    return images


def render():
    global SCREEN_IMAGES
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if not MUSIC.exists():
        raise FileNotFoundError(MUSIC)
    SCREEN_IMAGES = load_screens()
    write_text_assets()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found.")
    command = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
        "-i", str(MUSIC), "-map", "0:v:0", "-map", "1:a:0",
        "-af", "volume=0.34,afade=t=in:st=0:d=1.2,afade=t=out:st=51:d=4.8",
        "-t", str(DURATION),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", "-metadata", "title=인천중산고 노트북 포털 광고 영상",
        "-metadata", "artist=서지한, 이주진",
        str(VIDEO),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert process.stdin is not None
    poster = None
    try:
        frame_count = DURATION * FPS
        for frame_no in range(frame_count):
            t = frame_no / FPS
            frame = make_frame(t)
            if frame_no == round(7.5 * FPS):
                poster = frame.copy()
            process.stdin.write(frame.tobytes())
            if frame_no % (FPS * 7) == 0:
                print(f"Rendered {frame_no // FPS:02d}/{DURATION}s", flush=True)
        process.stdin.close()
        error = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
        code = process.wait()
        if code:
            raise RuntimeError(f"ffmpeg failed ({code}): {error}")
    finally:
        if process.stdin and not process.stdin.closed:
            process.stdin.close()
    if poster is not None:
        poster.thumbnail((1280, 720), Image.Resampling.LANCZOS)
        poster.save(POSTER, format="PNG", optimize=True)
    print(f"Created: {VIDEO}")
    print(f"Subtitles: {SUBTITLES}")
    print(f"Narration script: {NARRATION}")
    print(f"Poster: {POSTER}")


if __name__ == "__main__":
    render()
