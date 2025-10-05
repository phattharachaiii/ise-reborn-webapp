// src/lib/constants/meet-places.ts
export type CampusSpot = { id: string; name: string; area: string; open?: string };

export const CAMPUS_SPOTS: CampusSpot[] = [
    // โซนคณะและวิทยาลัย
    { id: 'eng_faculty', name: 'หน้าคณะวิศวกรรมศาสตร์', area: 'โซนคณะ' },
    { id: 'it_faculty', name: 'หน้าคณะเทคโนโลยีสารสนเทศ', area: 'โซนคณะ' },
    { id: 'sci_faculty', name: 'หน้าคณะวิทยาศาสตร์', area: 'โซนคณะ' },
    { id: 'arch_faculty', name: 'หน้าคณะสถาปัตยกรรม ศิลปะและการออกแบบ', area: 'โซนคณะ' },
    { id: 'agri_faculty', name: 'หน้าคณะเทคโนโลยีการเกษตร', area: 'โซนคณะ' },
    { id: 'ind_edu_faculty', name: 'หน้าคณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี', area: 'โซนคณะ' },
    { id: 'agro_ind_faculty', name: 'หน้าคณะอุตสาหกรรมเกษตร', area: 'โซนคณะ' },
    { id: 'medicine_faculty', name: 'หน้าคณะแพทยศาสตร์', area: 'โซนคณะ' },
    { id: 'liberal_arts_faculty', name: 'หน้าคณะศิลปศาสตร์', area: 'โซนคณะ' },
    { id: 'ic_college', name: 'หน้าวิทยาลัยนานาชาติ', area: 'โซนคณะ' },

    // โซนอาคารเรียนรวมและสำนักงาน
    { id: 'central_library', name: 'หน้าหอสมุดกลาง', area: 'โซนวิชาการ', open: '08:00–20:00' },
    { id: 'president_office', name: 'หน้าอาคารกรมหลวงนราธิวาสราชนครินทร์ (ตึกอธิการ)', area: 'โซนสำนักงาน' },
    { id: 'ecc_building', name: 'หน้าอาคารเรียนรวมสมเด็จพระเทพฯ (อาคาร ECC)', area: 'โซนอาคารเรียนรวม' },
    { id: 'chalermprakiat_building', name: 'หน้าอาคารเฉลิมพระเกียรติ ๗๒ พรรษา (ตึก 12 ชั้น)', area: 'โซนอาคารเรียนรวม' },
    { id: 'kmitl_convention_hall', name: 'หอประชุมเจ้าพระยาสุรวงษ์ไวยวัฒน์', area: 'โซนวิชาการ' },
    { id: 'computer_service_center', name: 'หน้าสำนักบริการคอมพิวเตอร์', area: 'โซนวิชาการ' },

    // โซนหอพักและสวัสดิการ
    { id: 'canteen_a', name: 'โรงอาหาร A (โรงอาหารคณะวิศวะ)', area: 'โซนกลาง' },
    { id: 'canteen_c', name: 'โรงอาหาร C (โรงอาหารกลาง)', area: 'โซนกลาง' },
    { id: 'fbt_canteen', name: 'โรงอาหาร FBT (โรงอาหารติดแอร์)', area: 'โซนกลาง' },
    { id: 'student_dorm_in', name: 'หอพักนักศึกษาใน', area: 'โซนหอพัก' },
    { id: 'student_dorm_out', name: 'หอพักนักศึกษานอก (FBT)', area: 'โซนหอพัก' },
    { id: 'kmitl_bookstore', name: 'ศูนย์หนังสือ สจล.', area: 'โซนสวัสดิการ' },
    { id: 'krungthai_bank', name: 'ธนาคารกรุงไทย (สาขา สจล.)', area: 'โซนสวัสดิการ' },

    // โซนกีฬาและนันทนาการ
    { id: 'main_stadium', name: 'สนามกีฬาหลัก (สนามฟุตบอล)', area: 'โซนกีฬา' },
    { id: 'swimming_pool', name: 'สระว่ายน้ำพระจอมเกล้าฯ', area: 'โซนกีฬา' },
    { id: 'tennis_court', name: 'สนามเทนนิส', area: 'โซนกีฬา' },
    { id: 'indoor_gymnasium', name: 'โรงยิมเนเซียม', area: 'โซนกีฬา' },
    { id: 'rama4_park', name: 'สวนพระพุทธเจ้าหลวง ร.4', area: 'โซนพักผ่อน' },
    { id: 'agri_park', name: 'สวนเกษตร', area: 'โซนพักผ่อน' },

    // ทางเข้า-ออกและอื่นๆ
    { id: 'main_gate', name: 'ประตูใหญ่ (ทางเข้า-ออกหลัก)', area: 'ทางเข้า-ออก' },
    { id: 'railway_gate', name: 'ประตูทางรถไฟ', area: 'ทางเข้า-ออก' },
    { id: 'fbt_gate', name: 'ประตูฝั่ง FBT', area: 'ทางเข้า-ออก' },
    { id: 'kmitl_station', name: 'สถานีรถไฟพระจอมเกล้า', area: 'การเดินทาง' },
    { id: 'kmitl_minibus_station', name: 'ท่ารถตู้ สจล.', area: 'การเดินทาง' },
    { id: 'e-san_market', name: 'ตลาดนัดคณะสถาปัตย์ (ตลาดอีสาน)', area: 'อื่นๆ' },
];
