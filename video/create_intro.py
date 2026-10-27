from __future__ import annotations

import math
import shutil
import subprocess
import wave
from array import array
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
VIDEO = OUT / "인천중산고_노트북_포털_소개.mp4"
POSTER = OUT / "인천중산고_노트북_포털_소개_포스터.png"
SUBTITLES = OUT / "인천중산고_노트북_포털_소개.srt"

WIDTH, HEIGHT, FPS = 1920, 1080, 24
SCENE_SECONDS = 6
SCENES = 8
DURATION = SCENE_SECONDS * SCENES
TRANSITION = 0.35

BG_TOP = (250, 248, 242)
BG_BOTTOM = (242, 238, 228)
INK = (39, 57, 47)
GREEN = (83, 117, 89)
GREEN_DARK = (40, 64, 49)
GREEN_PALE = (225, 237, 222)
GOLD = (184, 145, 82)
GOLD_PALE = (245, 236, 215)
TEXT = (47, 55, 47)
MUTED = (112, 116, 105)
LINE = (231, 228, 218)
WHITE = (255, 255, 252)
BLUE_PALE = (231, 238, 239)
BLUE = (80, 116, 125)
RED_PALE = (247, 233, 223)
RED = (167, 101, 76)

FONT_REGULAR = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 24)
FONT_BOLD = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 24)

COPY = [
    {
        "eyebrow": "인천중산고 · 학습 지원 안내",
        "title": "학교 노트북,\n더 체계적으로.",
        "body": "필요한 순간에 신청하고,\n처리부터 반납까지 확인합니다.",
        "caption": "학교 노트북 대여와 장비 관리를, 한 곳에서 더 쉽게.",
        "nav": "홈",
    },
    {
        "eyebrow": "처음부터 끝까지",
        "title": "대여의 전 과정을\n한눈에.",
        "body": "신청 · 검토 · 배정 · 반납\n모든 단계가 한 흐름으로 이어집니다.",
        "caption": "신청하고, 상태를 확인하고, 반납까지 이어서 관리합니다.",
        "nav": "홈",
    },
    {
        "eyebrow": "STEP 01 · 교과 대여",
        "title": "시간표에 맞춰\n간편하게 신청.",
        "body": "필요한 요일과 교시를 고르고\n한 번에 신청 내용을 확인해요.",
        "caption": "요일과 교시를 선택해 수업용 노트북을 신청합니다.",
        "nav": "교과 대여",
    },
    {
        "eyebrow": "STEP 02 · 가정 대여",
        "title": "배움이 이어지는\n기간을 선택.",
        "body": "대여 기간과 사용 목적을 적고\n학교의 반출 안내를 확인합니다.",
        "caption": "집에서도 학습이 이어지도록, 필요한 기간과 사유를 적어 신청해요.",
        "nav": "가정 대여",
    },
    {
        "eyebrow": "STEP 03 · 내 신청 확인",
        "title": "현재 상태를\n바로 확인.",
        "body": "대기 · 승인 · 반납 상태와\n배정된 기기 번호를 살펴보세요.",
        "caption": "대여 기록과 알림에서 처리 상태와 배정 번호를 확인합니다.",
        "nav": "대여 기록",
    },
    {
        "eyebrow": "담당자 · 장비 관리",
        "title": "승인은 명확하게,\n장비는 정확하게.",
        "body": "담당자는 요청을 검토하고\n승인 뒤 사용 가능한 기기를 배정합니다.",
        "caption": "담당자는 신청을 검토하고, 장비 현황과 반납을 관리합니다.",
        "nav": "승인 관리",
    },
    {
        "eyebrow": "안전하고 책임 있게",
        "title": "바르게 사용하고\n꼼꼼하게 반납.",
        "body": "승인된 목적과 기간을 지키고\n담당자에게 직접 반납해요.",
        "caption": "학교 계정으로 로그인하고, 승인된 목적과 기간에 맞춰 사용해요.",
        "nav": "이용 안내",
    },
    {
        "eyebrow": "인천중산고 노트북 포털",
        "title": "신청은 간편하게,\n관리는 명확하게.",
        "body": "학교에서 안내한 주소에서 시작하세요.\n나의 학습을 위한 노트북 대여 안내",
        "caption": "인천중산고 노트북 포털 · 신청부터 반납까지 한눈에.",
        "nav": "홈",
    },
]


def smooth(p: float) -> float:
    p = max(0.0, min(1.0, p))
    return p * p * (3 - 2 * p)


def blend_color(a: tuple[int, int, int], b: tuple[int, int, int], p: float):
    return tuple(round(a[i] + (b[i] - a[i]) * p) for i in range(3))


def make_background() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    d = ImageDraw.Draw(img)
    for y in range(HEIGHT):
        p = y / (HEIGHT - 1)
        d.line((0, y, WIDTH, y), fill=blend_color(BG_TOP, BG_BOTTOM, p))
    d.ellipse((1230, -530, 2190, 430), fill=(245, 240, 226))
    d.ellipse((-500, 620, 300, 1420), fill=(239, 240, 227))
    d.ellipse((1580, 670, 2080, 1170), fill=(238, 233, 219))
    d.arc((1130, 340, 1990, 1200), 205, 330, fill=(230, 226, 211), width=2)
    d.arc((1190, 390, 1930, 1130), 205, 330, fill=(235, 231, 219), width=2)
    return img


BACKGROUND = make_background()


def label(d: ImageDraw.ImageDraw, xy, text: str, font=FONT_REGULAR, fill=TEXT):
    d.text(xy, text, font=font, fill=fill)


def pill(d: ImageDraw.ImageDraw, box, text: str, fill, color=GREEN_DARK, font=FONT_BOLD):
    d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - tw) / 2
    y = box[1] + (box[3] - box[1] - th) / 2 - bbox[1] - 1
    d.text((x, y), text, font=font, fill=color)


def draw_check(d: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, fill=GREEN):
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=fill)
    d.line((cx - radius * 0.45, cy, cx - radius * 0.08, cy + radius * 0.36), fill=WHITE, width=3)
    d.line((cx - radius * 0.08, cy + radius * 0.36, cx + radius * 0.48, cy - radius * 0.4), fill=WHITE, width=3)


def draw_book_mark(d: ImageDraw.ImageDraw, x: int, y: int, size: int, color=WHITE):
    width = max(2, size // 10)
    mid = x + size // 2
    top, bottom = y + size // 7, y + size - size // 7
    d.line((x, top + 2, mid - 2, top, mid, top + 4, mid, bottom - 2, mid - 3, bottom - 5, x, bottom - 2, x, top + 2), fill=color, width=width, joint="curve")
    d.line((mid, top + 4, mid + 3, top, x + size, top + 2, x + size, bottom - 2, mid + 3, bottom - 5, mid, bottom - 2), fill=color, width=width, joint="curve")


def draw_brand(d: ImageDraw.ImageDraw):
    d.rounded_rectangle((124, 66, 174, 116), radius=16, fill=GREEN_DARK)
    draw_book_mark(d, 136, 77, 27, WHITE)
    label(d, (190, 69), "인천중산고", FONT_BOLD, INK)
    label(d, (190, 96), "노트북 포털", FONT_REGULAR, MUTED)
    d.line((124, 148, 1796, 148), fill=(225, 222, 211), width=1)
    pill(d, (1582, 73, 1796, 113), "서비스 화면 예시", (255, 255, 252), MUTED, FONT_REGULAR)


def draw_caption(d: ImageDraw.ImageDraw, text: str):
    d.rounded_rectangle((124, 911, 1796, 989), radius=24, fill=GREEN_DARK)
    d.rounded_rectangle((151, 935, 157, 965), radius=3, fill=GOLD)
    label(d, (180, 932), text, FONT_REGULAR, WHITE)


def draw_progress(d: ImageDraw.ImageDraw, t: float):
    x0, y0, width = 124, 1025, 1672
    d.rounded_rectangle((x0, y0, x0 + width, y0 + 6), radius=3, fill=(220, 219, 208))
    d.rounded_rectangle((x0, y0, x0 + int(width * max(0, min(1, t / DURATION))), y0 + 6), radius=3, fill=GREEN)
    for i in range(SCENES):
        cx = x0 + round(width * (i / (SCENES - 1)))
        d.ellipse((cx - 6, y0 - 5, cx + 6, y0 + 11), fill=GOLD if i == min(SCENES - 1, int(t / SCENE_SECONDS)) else (214, 209, 194))


def draw_left_copy(d: ImageDraw.ImageDraw, index: int, local: float):
    c = COPY[index]
    slide = round(24 * (1 - smooth(local / 0.45)))
    x = 130 + slide
    pill(d, (x, 203, x + 286, 248), c["eyebrow"], GREEN_PALE, GREEN_DARK, FONT_REGULAR)
    d.multiline_text((x, 294), c["title"], font=ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 67), fill=INK, spacing=22)
    body_y = 493 if "\n" in c["title"] else 430
    d.multiline_text((x + 3, body_y), c["body"], font=ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 28), fill=MUTED, spacing=15)
    if index in (0, 1, 7):
        draw_left_steps(d, x, body_y + 154, index)
    elif index in (2, 3, 4, 5, 6):
        draw_scene_note(d, x, body_y + 158, index)


def draw_left_steps(d: ImageDraw.ImageDraw, x: int, y: int, index: int):
    if index == 0:
        items = [("01", "수업에서"), ("02", "집에서"), ("03", "신청 확인")]
    elif index == 1:
        items = [("01", "신청"), ("02", "검토·배정"), ("03", "반납")]
    else:
        items = [("01", "학교 계정"), ("02", "대여 신청"), ("03", "반납 확인")]
    for i, (num, text) in enumerate(items):
        yy = y + i * 52
        d.ellipse((x, yy, x + 29, yy + 29), fill=GOLD_PALE)
        label(d, (x + 7, yy + 4), num, ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 14), GOLD)
        label(d, (x + 44, yy + 2), text, FONT_BOLD, INK)


def draw_scene_note(d: ImageDraw.ImageDraw, x: int, y: int, index: int):
    notes = {
        2: [("선택", "요일과 교시"), ("확인", "한 번에 신청")],
        3: [("기입", "대여 기간·목적"), ("확인", "학교의 반출 안내")],
        4: [("확인", "처리 상태"), ("알림", "기기 배정 번호")],
        5: [("검토", "신청 내용 확인"), ("관리", "장비 현황·반납")],
        6: [("로그인", "학교에서 안내한 계정"), ("반납", "담당자에게 직접 전달")],
    }
    for i, (tag, text) in enumerate(notes.get(index, [])):
        yy = y + i * 58
        draw_check(d, x + 12, yy + 12, 12, GREEN if i == 0 else GOLD)
        label(d, (x + 37, yy - 2), tag, FONT_BOLD, INK)
        label(d, (x + 152, yy - 2), text, FONT_REGULAR, MUTED)


def draw_browser_frame(img: Image.Image, active: str, t: float):
    d = ImageDraw.Draw(img)
    x, y, w, h = 826, 178, 970, 686
    # Soft, crisp shadow and framed app surface.
    d.rounded_rectangle((x + 10, y + 14, x + w + 10, y + h + 14), radius=30, fill=(222, 219, 209))
    d.rounded_rectangle((x, y, x + w, y + h), radius=29, fill=WHITE, outline=(226, 223, 213), width=2)
    d.rounded_rectangle((x + 1, y + 1, x + w - 1, y + 57), radius=28, fill=(247, 246, 240))
    d.rectangle((x + 1, y + 31, x + w - 1, y + 57), fill=(247, 246, 240))
    for j, color in enumerate(((218, 151, 129), (219, 186, 117), (138, 170, 142))):
        d.ellipse((x + 22 + j * 19, y + 23, x + 32 + j * 19, y + 33), fill=color)
    d.rounded_rectangle((x + 112, y + 15, x + 624, y + 42), radius=12, fill=(255, 255, 252), outline=(235, 232, 222))
    label(d, (x + 132, y + 17), "인천중산고 노트북 포털", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    pill(d, (x + w - 175, y + 14, x + w - 21, y + 42), "학교 계정", GREEN_PALE, GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15))

    side_x = x + 1
    side_y = y + 58
    side_w = 188
    side_h = h - 59
    d.rounded_rectangle((side_x, side_y, side_x + side_w, side_y + side_h), radius=0, fill=(249, 248, 244))
    d.rounded_rectangle((side_x, side_y, side_x + side_w, side_y + 4), radius=0, fill=(249, 248, 244))
    d.rounded_rectangle((side_x + 18, side_y + 22, side_x + 54, side_y + 58), radius=11, fill=GREEN_DARK)
    draw_book_mark(d, side_x + 27, side_y + 29, 18, WHITE)
    label(d, (side_x + 64, side_y + 22), "학습 도구", FONT_BOLD, INK)
    label(d, (side_x + 64, side_y + 45), "대여 포털", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
    nav_items = ["홈", "대여 기록", "노트북 관리", "승인 관리", "알림", "이용 안내"] if active == "승인 관리" else ["홈", "교과 대여", "가정 대여", "대여 기록", "알림", "이용 안내"]
    nav_y = side_y + 94
    nav_fonts = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16)
    for i, item in enumerate(nav_items):
        yy = nav_y + i * 51
        if item == active:
            d.rounded_rectangle((side_x + 12, yy - 6, side_x + side_w - 13, yy + 34), radius=12, fill=GREEN_PALE)
        d.ellipse((side_x + 24, yy + 6, side_x + 34, yy + 16), fill=GREEN if item == active else (180, 183, 174))
        label(d, (side_x + 47, yy + 1), item, nav_fonts, GREEN_DARK if item == active else MUTED)

    content_x = x + 224
    content_y = y + 87
    return d, (content_x, content_y, x + w - 26, y + h - 25)


def box(d: ImageDraw.ImageDraw, coords, fill=WHITE, outline=LINE, radius=18, width=1):
    d.rounded_rectangle(coords, radius=radius, fill=fill, outline=outline, width=width)


def draw_dashboard(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "안녕하세요", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 17), MUTED)
    label(d, (left, top + 25), "나의 학습 도구", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 33), INK)
    label(d, (left, top + 71), "필요한 기기를 편리하게 신청하고 관리하세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16), MUTED)
    box(d, (left, top + 112, right, top + 254), (245, 241, 229), (239, 235, 222), 20)
    pill(d, (left + 20, top + 128, left + 143, top + 161), "나의 포털", (255, 255, 252), GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14))
    label(d, (left + 22, top + 178), "학습에 필요한 순간,", FONT_BOLD, INK)
    label(d, (left + 22, top + 210), "노트북 대여를 한눈에.", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 24), GREEN_DARK)
    # Quiet laptop illustration.
    d.rounded_rectangle((right - 198, top + 139, right - 76, top + 216), radius=10, fill=GREEN_DARK)
    d.rounded_rectangle((right - 190, top + 147, right - 84, top + 207), radius=6, fill=(240, 243, 234))
    d.ellipse((right - 149, top + 166, right - 125, top + 190), fill=(205, 220, 202))
    d.polygon([(right - 216, top + 220), (right - 58, top + 220), (right - 76, top + 231), (right - 201, top + 231)], fill=(182, 190, 177))
    cards = [("교과 대여", "시간표에 맞춰", GREEN_PALE, GREEN_DARK), ("가정 대여", "기간을 선택해", GOLD_PALE, GOLD), ("신청 기록", "진행 상태 확인", BLUE_PALE, BLUE)]
    gap = 13
    card_w = (right - left - gap * 2) // 3
    yy = top + 278
    for i, (title, sub, fill, color) in enumerate(cards):
        xx = left + i * (card_w + gap)
        box(d, (xx, yy, xx + card_w, yy + 130), WHITE, LINE, 16)
        d.rounded_rectangle((xx + 15, yy + 15, xx + 49, yy + 49), radius=11, fill=fill)
        d.ellipse((xx + 26, yy + 26, xx + 38, yy + 38), fill=color)
        label(d, (xx + 15, yy + 62), title, FONT_BOLD, INK)
        label(d, (xx + 15, yy + 91), sub, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    box(d, (left, yy + 150, right, yy + 201), (250, 249, 244), LINE, 15)
    label(d, (left + 18, yy + 164), "역할에 따라 사용할 수 있는 메뉴가 달라집니다.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16), MUTED)


def draw_workflow(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "신청부터 반납까지", FONT_BOLD, INK)
    label(d, (left, top + 37), "순서대로 확인하면 더 쉬워요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16), MUTED)
    labels = [("01", "신청", "필요한 대여 선택"), ("02", "검토", "담당자가 확인"), ("03", "배정", "기기 번호 확인"), ("04", "반납", "완료 상태 확인")]
    start_x, cy = left + 32, top + 217
    gap = 162
    active = min(3, int(max(0, t) / 1.2))
    d.line((start_x + 43, cy, start_x + 43 + gap * 3, cy), fill=(218, 219, 207), width=6)
    d.line((start_x + 43, cy, start_x + 43 + gap * max(0, min(1, t / 4.5)) * 3, cy), fill=GREEN, width=6)
    for i, (num, title, sub) in enumerate(labels):
        cx = start_x + i * gap
        col = GREEN if i <= active else (195, 198, 187)
        d.ellipse((cx + 18, cy - 27, cx + 68, cy + 23), fill=col)
        label(d, (cx + 31, cy - 14), "✓" if i < active else num, ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 16), WHITE)
        label(d, (cx + 3, cy + 43), title, FONT_BOLD, INK if i <= active else MUTED)
        label(d, (cx - 17, cy + 74), sub, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13), MUTED)
    box(d, (left + 6, top + 379, right - 6, top + 464), GREEN_PALE, (220, 232, 217), 16)
    draw_check(d, left + 35, top + 420, 13, GREEN)
    label(d, (left + 60, top + 403), "내 신청에서 현재 단계와 안내를 확인하세요.", FONT_BOLD, GREEN_DARK)


def draw_class_rental(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "주간 교과 대여", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 25), INK)
    label(d, (left, top + 39), "필요한 요일과 교시를 선택하세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    pill(d, (right - 200, top + 3, right - 6, top + 38), "주차 선택", GREEN_PALE, GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14))
    names = ["월", "화", "수", "목", "금"]
    col_w = 103
    grid_x = left + 7
    grid_y = top + 105
    for col, day in enumerate(names):
        xx = grid_x + col * col_w
        label(d, (xx + 34, grid_y), day, FONT_BOLD, MUTED)
        for row in range(4):
            yy = grid_y + 38 + row * 65
            is_selected = (col == 0 and row == 1) or (col == 2 and row == 2) or (col == 4 and row == 0)
            elapsed = max(0.0, min(1.0, (t - col * 0.34 - row * 0.08) / 0.42))
            show = is_selected and elapsed > 0
            if show:
                fill, outline = (216, 233, 214), GREEN
            else:
                fill, outline = (255, 255, 252), (232, 229, 220)
            box(d, (xx, yy, xx + 88, yy + 48), fill, outline, 11)
            label(d, (xx + 32, yy + 13), f"{row + 1}", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), GREEN_DARK if show else MUTED)
    box(d, (left + 8, top + 323, right - 6, top + 394), (249, 248, 242), LINE, 15)
    label(d, (left + 24, top + 339), "선택한 교시", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
    pill(d, (left + 202, top + 335, left + 349, top + 368), "3개 선택", GREEN_PALE, GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14))
    box(d, (right - 191, top + 326, right - 11, top + 380), GREEN_DARK, GREEN_DARK, 15)
    label(d, (right - 161, top + 342), "신청 내용 확인", FONT_BOLD, WHITE)
    label(d, (left + 9, top + 414), "선택 후 제출하면 담당자 승인 뒤 기기가 배정됩니다.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)


def draw_home_rental(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "가정 대여 신청", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 25), INK)
    label(d, (left, top + 39), "필수 내용을 차례로 입력합니다.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    label(d, (left + 9, top + 91), "대여 기간", FONT_BOLD, INK)
    box(d, (left + 8, top + 122, left + 239, top + 188), WHITE, LINE, 14)
    box(d, (left + 256, top + 122, left + 486, top + 188), WHITE, LINE, 14)
    label(d, (left + 25, top + 134), "시작일", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13), MUTED)
    label(d, (left + 25, top + 159), "날짜 선택", FONT_BOLD, INK)
    label(d, (left + 273, top + 134), "반납 예정일", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13), MUTED)
    label(d, (left + 273, top + 159), "날짜 선택", FONT_BOLD, INK)
    label(d, (left + 9, top + 216), "사용 목적", FONT_BOLD, INK)
    box(d, (left + 8, top + 247, right - 9, top + 339), WHITE, LINE, 14)
    label(d, (left + 25, top + 266), "학습에 필요한 내용을 간단히 적어주세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), (153, 156, 145))
    # Animated typed line.
    typed = min(18, int(max(0, t - 1.2) * 9))
    line_text = "수업 과제와 학습 자료 정리"
    if typed:
        label(d, (left + 25, top + 303), line_text[:typed], ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), GREEN_DARK)
    box(d, (left + 9, top + 366, right - 9, top + 421), (248, 246, 238), (239, 235, 224), 13)
    label(d, (left + 25, top + 381), "신청 전 학교의 반출 규정과 대여 가능 기간을 확인하세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
    box(d, (right - 203, top + 446, right - 9, top + 492), GREEN_DARK, GREEN_DARK, 14)
    label(d, (right - 167, top + 459), "신청 제출", FONT_BOLD, WHITE)


def draw_records(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "나의 대여 기록", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 25), INK)
    label(d, (left, top + 39), "최근 신청의 처리 상태를 확인합니다.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    box(d, (left + 5, top + 90, right - 5, top + 204), WHITE, LINE, 17)
    pill(d, (left + 24, top + 108, left + 150, top + 139), "교과 대여", GREEN_PALE, GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13))
    label(d, (left + 24, top + 155), "내 신청", FONT_BOLD, INK)
    pill(d, (right - 190, top + 128, right - 24, top + 162), "승인 대기", GOLD_PALE, GOLD, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14))
    label(d, (left + 24, top + 184), "신청 내용과 결과를 한 곳에서", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
    labels = [("신청 접수", "완료"), ("담당자 검토", "진행"), ("기기 배정", "다음 단계"), ("반납 확인", "마지막 단계")]
    y = top + 252
    active = min(3, int(max(0, t) / 1.15))
    d.line((left + 34, y + 11, left + 34, y + 183), fill=(221, 222, 212), width=4)
    for i, (title, sub) in enumerate(labels):
        yy = y + i * 56
        if i == 0 or i < active:
            draw_check(d, left + 34, yy + 11, 13, GREEN)
        else:
            d.ellipse((left + 22, yy - 1, left + 46, yy + 23), fill=WHITE, outline=(209, 211, 201), width=2)
        label(d, (left + 61, yy - 5), title, FONT_BOLD if i <= active else FONT_REGULAR, INK if i <= active else MUTED)
        pill(d, (right - 153, yy - 2, right - 24, yy + 25), sub, GREEN_PALE if i <= active else (247, 246, 241), GREEN_DARK if i <= active else MUTED, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 12))


def draw_approval(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "승인 관리", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 25), INK)
    label(d, (left, top + 39), "대기 중인 요청을 확인합니다.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    box(d, (left + 3, top + 89, left + 420, top + 319), WHITE, LINE, 17)
    pill(d, (left + 21, top + 107, left + 150, top + 138), "교과 대여", GREEN_PALE, GREEN_DARK, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13))
    pill(d, (left + 283, top + 107, left + 398, top + 138), "검토 필요", GOLD_PALE, GOLD, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13))
    label(d, (left + 21, top + 157), "학생 신청", FONT_BOLD, INK)
    label(d, (left + 21, top + 190), "선택한 요일 · 교시", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    label(d, (left + 21, top + 221), "수업용 노트북 신청", FONT_BOLD, INK)
    if t < 3.2:
        box(d, (left + 20, top + 260, left + 197, top + 301), (249, 248, 244), LINE, 12)
        label(d, (left + 49, top + 270), "신청 내용 보기", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
        box(d, (left + 209, top + 260, left + 398, top + 301), GREEN_DARK, GREEN_DARK, 12)
        label(d, (left + 268, top + 270), "승인", FONT_BOLD, WHITE)
    else:
        box(d, (left + 20, top + 260, left + 398, top + 301), GREEN_PALE, (215, 231, 211), 12)
        draw_check(d, left + 45, top + 281, 11, GREEN)
        label(d, (left + 68, top + 270), "승인 완료 · 기기 배정", FONT_BOLD, GREEN_DARK)
    box(d, (left + 3, top + 340, left + 420, top + 411), (249, 248, 244), LINE, 15)
    label(d, (left + 22, top + 353), "기기 현황", FONT_BOLD, INK)
    label(d, (left + 22, top + 380), "사용 가능 장비를 함께 살펴보세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 14), MUTED)
    # Compact, illustrative inventory board with no real student or device data.
    ix, iy = left + 459, top + 118
    box(d, (ix - 14, iy - 17, right - 3, top + 411), (249, 248, 244), LINE, 17)
    label(d, (ix + 5, iy - 2), "노트북 현황", FONT_BOLD, INK)
    d.line((ix + 5, iy + 31, right - 24, iy + 31), fill=LINE, width=1)
    for i in range(12):
        col, row = i % 4, i // 4
        xx, yy = ix + 5 + col * 64, iy + 48 + row * 75
        is_busy = i in (2, 7, 10)
        fill, color = (GREEN_PALE, GREEN_DARK) if not is_busy else (BLUE_PALE, BLUE)
        box(d, (xx, yy, xx + 52, yy + 56), fill, fill, 11)
        label(d, (xx + 17, yy + 8), f"{i + 1:02}", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 16), color)
        label(d, (xx + 9, yy + 32), "대여 중" if is_busy else "가능", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 11), color)
    label(d, (ix + 5, top + 378), "승인 시 사용 가능한 기기를 자동 배정", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13), MUTED)


def draw_safety(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    label(d, (left, top), "안전한 이용을 위한 약속", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 24), INK)
    label(d, (left, top + 39), "모두의 학습을 위해 차례로 확인해요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    steps = [
        ("01", "학교 계정으로 로그인", "학교에서 안내한 Google 계정 사용"),
        ("02", "승인 범위 확인", "허가된 목적과 기간에 맞춰 사용"),
        ("03", "담당자에게 직접 반납", "기기 전달 뒤 반납 완료 확인"),
    ]
    for i, (num, title, sub) in enumerate(steps):
        yy = top + 93 + i * 102
        selected = t >= i * 1.35
        fill = GREEN_PALE if selected else (250, 249, 245)
        box(d, (left + 3, yy, right - 3, yy + 79), fill, (225, 232, 220) if selected else LINE, 15)
        d.ellipse((left + 20, yy + 19, left + 60, yy + 59), fill=GREEN_DARK if selected else (229, 228, 219))
        label(d, (left + 31, yy + 29), num, ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 13), WHITE if selected else MUTED)
        label(d, (left + 80, yy + 15), title, FONT_BOLD, INK)
        label(d, (left + 80, yy + 43), sub, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 13), MUTED)
    box(d, (left + 3, top + 415, right - 3, top + 474), GREEN_DARK, GREEN_DARK, 15)
    label(d, (left + 25, top + 431), "대여 기록 또는 알림에서 반납 완료를 확인하세요.", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), WHITE)


def draw_closing(d: ImageDraw.ImageDraw, area, t: float):
    left, top, right, bottom = area
    d.rounded_rectangle((left, top, right, bottom), radius=24, fill=(244, 241, 231), outline=(233, 229, 218), width=1)
    # Minimal school learning vignette.
    bx, by = right - 288, top + 88
    d.ellipse((bx - 56, by - 47, bx + 188, by + 197), fill=(234, 229, 216))
    d.rounded_rectangle((bx, by, bx + 172, by + 113), radius=16, fill=GREEN_DARK)
    d.rounded_rectangle((bx + 10, by + 10, bx + 162, by + 100), radius=10, fill=(247, 247, 240))
    d.ellipse((bx + 66, by + 38, bx + 105, by + 77), fill=GREEN_PALE)
    d.line((bx - 18, by + 124, bx + 193, by + 124), fill=(169, 179, 164), width=9)
    d.line((bx + 28, by + 132, bx + 150, by + 132), fill=(197, 199, 188), width=5)
    label(d, (left + 28, top + 34), "인천중산고", FONT_BOLD, MUTED)
    label(d, (left + 28, top + 80), "노트북 포털", ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 29), INK)
    d.line((left + 28, top + 132, right - 30, top + 132), fill=(226, 221, 207), width=1)
    label(d, (left + 28, top + 159), "학교에서 안내한 주소에서 시작하세요.", FONT_BOLD, GREEN_DARK)
    label(d, (left + 28, top + 196), "배움을 위한 노트북 대여 안내", ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15), MUTED)
    pill(d, (left + 28, top + 244, left + 240, top + 284), "신청부터 반납까지", GREEN_DARK, WHITE, ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 15))


def draw_app_scene(img: Image.Image, index: int, local: float):
    d, area = draw_browser_frame(img, COPY[index]["nav"], local)
    funcs = [draw_dashboard, draw_workflow, draw_class_rental, draw_home_rental, draw_records, draw_approval, draw_safety, draw_closing]
    funcs[index](d, area, local)


def draw_scene(index: int, local: float, absolute: float) -> Image.Image:
    img = BACKGROUND.copy()
    d = ImageDraw.Draw(img)
    draw_brand(d)
    draw_left_copy(d, index, local)
    draw_app_scene(img, index, local)
    d = ImageDraw.Draw(img)
    draw_caption(d, COPY[index]["caption"])
    draw_progress(d, absolute)
    return img


def make_frame(t: float) -> Image.Image:
    idx = min(SCENES - 1, int(t // SCENE_SECONDS))
    local = t - idx * SCENE_SECONDS
    current = draw_scene(idx, local, t)
    if idx > 0 and local < TRANSITION:
        previous = draw_scene(idx - 1, SCENE_SECONDS - TRANSITION + local, t)
        return Image.blend(previous, current, smooth(local / TRANSITION))
    if idx == 0 and t < TRANSITION:
        return Image.blend(BACKGROUND, current, smooth(t / TRANSITION))
    if idx == SCENES - 1 and local > SCENE_SECONDS - TRANSITION:
        fade = smooth((local - (SCENE_SECONDS - TRANSITION)) / TRANSITION)
        return Image.blend(current, BACKGROUND, fade * 0.25)
    return current


def create_music(path: Path):
    sample_rate = 48000
    total_samples = DURATION * sample_rate
    chords = [
        (146.83, 220.00, 293.66, 369.99),
        (130.81, 196.00, 261.63, 329.63),
        (110.00, 164.81, 220.00, 277.18),
        (123.47, 185.00, 246.94, 293.66),
    ]
    samples = array("h")
    for n in range(total_samples):
        t = n / sample_rate
        bar = int(t // 6) % len(chords)
        next_bar = (bar + 1) % len(chords)
        within = (t % 6) / 6
        xfade = smooth((within - 0.83) / 0.17)
        chord = chords[bar]
        other = chords[next_bar]
        env = min(1.0, t / 1.4, (DURATION - t) / 2.6)
        pulse = 0.84 + 0.16 * math.sin(2 * math.pi * t / 3.0)
        value = 0.0
        for k, (freq, next_freq) in enumerate(zip(chord, other)):
            f = freq * (1 - xfade) + next_freq * xfade
            phase = 2 * math.pi * f * t
            amp = (0.32 if k == 0 else (0.21 if k < 3 else 0.14))
            value += amp * (math.sin(phase) + 0.18 * math.sin(phase * 2))
        value *= env * pulse * 0.105
        sample = max(-1.0, min(1.0, value))
        packed = int(sample * 32767)
        samples.append(packed)
        samples.append(packed)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())


def srt_time(seconds: float) -> str:
    millis = round(seconds * 1000)
    hh, millis = divmod(millis, 3_600_000)
    mm, millis = divmod(millis, 60_000)
    ss, millis = divmod(millis, 1000)
    return f"{hh:02}:{mm:02}:{ss:02},{millis:03}"


def write_subtitles():
    lines = []
    for i, scene in enumerate(COPY):
        start = i * SCENE_SECONDS
        end = (i + 1) * SCENE_SECONDS
        lines.extend([str(i + 1), f"{srt_time(start)} --> {srt_time(end)}", scene["caption"], ""])
    SUBTITLES.write_text("\n".join(lines), encoding="utf-8-sig")


def render():
    OUT.mkdir(parents=True, exist_ok=True)
    temp_wav = OUT / ".intro_ambient.wav"
    create_music(temp_wav)
    write_subtitles()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found.")
    command = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0",
        "-i", str(temp_wav), "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-shortest",
        "-movflags", "+faststart", "-metadata", "title=인천중산고 노트북 포털 소개",
        str(VIDEO),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert process.stdin is not None
    poster = None
    try:
        total_frames = DURATION * FPS
        for frame_number in range(total_frames):
            t = frame_number / FPS
            frame = make_frame(t)
            if frame_number == FPS * 2:
                poster = frame.copy()
            process.stdin.write(frame.tobytes())
            if frame_number % (FPS * 6) == 0:
                print(f"Rendered {frame_number // FPS:02d}/{DURATION}s", flush=True)
        process.stdin.close()
        error = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
        code = process.wait()
        if code:
            raise RuntimeError(f"ffmpeg failed ({code}): {error}")
    finally:
        try:
            temp_wav.unlink(missing_ok=True)
        except OSError:
            pass
    if poster is not None:
        poster.thumbnail((1280, 720), Image.Resampling.LANCZOS)
        poster.save(POSTER, format="PNG", optimize=True)
    print(f"Created: {VIDEO}")
    print(f"Subtitles: {SUBTITLES}")
    print(f"Poster: {POSTER}")


if __name__ == "__main__":
    render()
