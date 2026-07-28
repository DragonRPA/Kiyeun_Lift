# 개발 지시 및 개편 완료 내역 (dev_temp.md)

- [완료] 배차 관리 (`TruckDispatch.tsx`) 기사 선택 시 차종/톤수 1초 자동 세팅 연동 수술
  1. `[👤 운송 기사명]` 드롭다운에서 기사를 지정/선택할 때 기사 연락처(`driverContact`), 차량번호(`vehicleNo`), 소속 운송사(`transportCompany`)뿐만 아니라 기사 마스터에 등록된 **차종/톤수(`vehicleType`) 정보까지 1초 만에 자동 채워지도록 수술**.
