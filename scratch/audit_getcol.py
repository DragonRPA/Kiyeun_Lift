import sys
sys.stdout.reconfigure(encoding='utf-8')

# 실제 엑셀 계약현황 헤더 (Row 2, 0-indexed)
actual_headers = {
    0: '업체명', 1: '순번', 2: '설치장소', 3: '최초개시일', 4: '개시일',
    5: '종료일', 6: '일수', 7: '운반비', 8: '계약구분', 9: '장비명',
    10: '관리번호', 11: '수량', 12: '장비명', 13: '관리번호', 14: '수량',
    15: '임차업체', 16: '협착소유', 17: '공장입고일', 18: '임차개시일',
    19: '반납일', 20: '임차단가', 21: '월렌탈료', 22: '당월렌탈료',
    23: '당월기타청구', 24: '기타내역', 25: '당월청구합계',
    26: '마감일', 27: '거래명세표', 28: '계산서', 29: '결재조건',
    30: '결재일', 31: '결재금액',
}

# buildHeaderMap 동작 시뮬레이션 (첫 번째 등장만 등록)
header_map = {}
for idx, col in actual_headers.items():
    key = col.replace(' ','').lower()
    if key not in header_map:
        header_map[key] = idx

print("=== buildHeaderMap 결과 (key→실제인덱스) ===")
for k,v in header_map.items():
    print(f"  '{k}' → Col[{v}] ({actual_headers[v]})")

# 각 getCol 호출 분석
print("\n=== getCol 호출별 실제 동작 분석 ===\n")

def simulate_getCol(keys, fallback_idx, var_name, want_col):
    """getCol이 어떤 컬럼을 실제로 읽는지 시뮬레이션"""
    for k in keys:
        search = k.replace(' ','').lower()
        # 1. Exact match
        if search in header_map:
            actual = header_map[search]
            status = "✅ OK" if actual == want_col else f"⚠️  키 매칭 성공했으나 목표({want_col}:{actual_headers.get(want_col,'?')})와 다른 인덱스 {actual}({actual_headers.get(actual,'?')}) 반환"
            print(f"  [{var_name}]")
            print(f"    keys={keys}, fallback={fallback_idx}")
            print(f"    → 키 '{k}' 정확 매칭 → Col[{actual}]({actual_headers.get(actual,'?')}) {status}")
            return
        # 2. Partial match
        for h_key, h_idx in header_map.items():
            if search in h_key:
                actual = h_idx
                status = "✅ OK" if actual == want_col else f"⚠️  부분 매칭이지만 목표({want_col})와 다름"
                print(f"  [{var_name}]")
                print(f"    keys={keys}, fallback={fallback_idx}")
                print(f"    → 키 '{k}' 부분 매칭 → Col[{actual}]({actual_headers.get(actual,'?')}) {status}")
                return
    # fallback
    actual = fallback_idx
    status = "✅ OK" if actual == want_col else f"❌ WRONG! 키 모두 불일치 → fallback Col[{actual}]({actual_headers.get(actual,'?')}) 반환, 원하는 건 Col[{want_col}]({actual_headers.get(want_col,'?')})"
    print(f"  [{var_name}]")
    print(f"    keys={keys}, fallback={fallback_idx}")
    print(f"    → 키 매칭 실패 → fallback Col[{actual}]({actual_headers.get(actual,'?')}) {status}")
    print()

# 각 getCol 호출 1:1 검증
simulate_getCol(['업체명','거래처명','고객명'], 0, 'rawCustName', 0)       # want: 0=업체명
simulate_getCol(['모델','기종','장비명'],       3, 'rawModel',   9)        # want: 9=장비명
simulate_getCol(['현장명'],                     2, 'rawSite',    2)        # want: 2=설치장소
simulate_getCol(['규격','모델','기종','장비명'], 3, 'rawHeight',  9)        # want: 9=장비명 (모델명에서 높이 추정)
simulate_getCol(['임차업체','매입처'],          15, 'leaseVendorName', 15)  # want: 15=임차업체
simulate_getCol(['임차단가','매입단가'],        16, 'leasePrice',     20)   # want: 20=임차단가
simulate_getCol(['전대반납일','반납일'],        17, 'leaseReturnDate', 19)  # want: 19=반납일
simulate_getCol(['계약시작일','시작일','출고일'], 4, 'rowStartDate',   4)   # want: 4=개시일
simulate_getCol(['계약종료일','종료일'],         5, 'rowEndDate',     5)   # want: 5=종료일
simulate_getCol(['월렌탈료','렌탈료','단가'],   22, 'rowMonthlyFee', 21)   # want: 21=월렌탈료
simulate_getCol(['당월청구액','청구합계'],      25, 'rowMonthlyFee_fallback', 25)  # want: 25=당월청구합계
simulate_getCol(['상태','결재상태'],            10, 'contractStatusStr', 8) # want: 8=계약구분? 실제 상태컬럼 없음
simulate_getCol(['운반비','왕복운반비'],        20, 'transportFee',   7)   # want: 7=운반비
