// 자동 생성 — 직접 고치지 말 것. 원본: gs-backend/JudgeMore.js·JudgeForm.js·Federation.js, 생성: tools/build-judge.js
// [2026.11.10] 판정 계산은 판정 서버(gs-judge)에서 — job 서버엔 이 대리 파일만 올라가고 JudgeMore.js는 .claspignore로 빠진다.
// 이름·묶음 이름·돌려주는 모양은 원본과 같다. 판정 서버에 닿지 못하면 오류로 드러낸다(빈 결과로 삼키지 않음).
var JUDGE_SERVER_URL_ = "https://script.google.com/macros/s/AKfycbxTdcIUxP9_tBV_ZXLHHS8VOFVcK030cIfzre-5Hbeajawib8-yZ3OeyR8p23L5_myv/exec";
function jmRemote_(body) {
  if (!JUDGE_SERVER_URL_) throw new Error('판정 서버 주소가 없음(tools/build-judge.js — gs-judge/server-url.txt)');
  var res, d;
  try { res = UrlFetchApp.fetch(JUDGE_SERVER_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify(body), muteHttpExceptions: true }); }
  catch (e) { throw new Error('판정 서버에 닿지 못함: ' + String(e && e.message || e).slice(0, 120)); }
  try { d = JSON.parse(res.getContentText()); } catch (e) { throw new Error('판정 서버에 닿지 못함: 답 모양이 틀림(' + res.getResponseCode() + ')'); }
  if (d && d.error) throw new Error('판정 서버: ' + d.error);
  return d ? d.r : null;
}
function judgeHeirPersonalDeduction_(p) { return jmRemote_({ fn: "judgeHeirPersonalDeduction_", p: p }); }
function judgeLeaseMortgageValuation_(p) { return jmRemote_({ fn: "judgeLeaseMortgageValuation_", p: p }); }
function judgeJointOwnership_(p) { return jmRemote_({ fn: "judgeJointOwnership_", p: p }); }
function judgeMergerDividend_(p) { return jmRemote_({ fn: "judgeMergerDividend_", p: p }); }
function judgeTreasuryStock_(p) { return jmRemote_({ fn: "judgeTreasuryStock_", p: p }); }
function judgeCrossGift_(p) { return jmRemote_({ fn: "judgeCrossGift_", p: p }); }
function judgeRetirementDeathPay_(p) { return jmRemote_({ fn: "judgeRetirementDeathPay_", p: p }); }
function judgeLoanReceivable_(p) { return jmRemote_({ fn: "judgeLoanReceivable_", p: p }); }
function judgeInsuranceTax_(p) { return jmRemote_({ fn: "judgeInsuranceTax_", p: p }); }
function judgeDisposalPresumption_(p) { return jmRemote_({ fn: "judgeDisposalPresumption_", p: p }); }
function judgeBizSuccessionGift_(p) { return jmRemote_({ fn: "judgeBizSuccessionGift_", p: p }); }
function judgeGiftAcquisitionDate_(p) { return jmRemote_({ fn: "judgeGiftAcquisitionDate_", p: p }); }
function judgeStockLotMatching_(p) { return jmRemote_({ fn: "judgeStockLotMatching_", p: p }); }
function judgeForeignEstateTaxCredit_(p) { return jmRemote_({ fn: "judgeForeignEstateTaxCredit_", p: p }); }
function judgeUnsoldHouse_(p) { return jmRemote_({ fn: "judgeUnsoldHouse_", p: p }); }
function judgeTransferSecurity_(p) { return jmRemote_({ fn: "judgeTransferSecurity_", p: p }); }
function judgeJointLiability_(p) { return jmRemote_({ fn: "judgeJointLiability_", p: p }); }
function judgeTaxPriority_(p) { return jmRemote_({ fn: "judgeTaxPriority_", p: p }); }
function judgeCorpSecondary_(p) { return jmRemote_({ fn: "judgeCorpSecondary_", p: p }); }
function judgeConvertibleBond_(p) { return jmRemote_({ fn: "judgeConvertibleBond_", p: p }); }
function judgeBusinessTransferee_(p) { return jmRemote_({ fn: "judgeBusinessTransferee_", p: p }); }
function judgeCollectionLimitation_(p) { return jmRemote_({ fn: "judgeCollectionLimitation_", p: p }); }
function judgeFinancialDeduction_(p) { return jmRemote_({ fn: "judgeFinancialDeduction_", p: p }); }
function judgeEstimatedPrice_(p) { return jmRemote_({ fn: "judgeEstimatedPrice_", p: p }); }
function judgeLateCorrectionClaim_(p) { return jmRemote_({ fn: "judgeLateCorrectionClaim_", p: p }); }
function judgePayDeadlineExtension_(p) { return jmRemote_({ fn: "judgePayDeadlineExtension_", p: p }); }
function judgePublicTrust_(p) { return jmRemote_({ fn: "judgePublicTrust_", p: p }); }
function judgeCharityAftercare_(p) { return jmRemote_({ fn: "judgeCharityAftercare_", p: p }); }
function judgeCulturalDeferral_(p) { return jmRemote_({ fn: "judgeCulturalDeferral_", p: p }); }
function judgeTrustInheritance_(p) { return jmRemote_({ fn: "judgeTrustInheritance_", p: p }); }
function judgeFarmCorpContribution_(p) { return jmRemote_({ fn: "judgeFarmCorpContribution_", p: p }); }
function judgeIncorp32_(p) { return jmRemote_({ fn: "judgeIncorp32_", p: p }); }
function judgeFactoryRelocation_(p) { return jmRemote_({ fn: "judgeFactoryRelocation_", p: p }); }
function judgeFarmlandExchange_(p) { return jmRemote_({ fn: "judgeFarmlandExchange_", p: p }); }
function judgeUnlistedValuation_(p) { return jmRemote_({ fn: "judgeUnlistedValuation_", p: p }); }
function judgeShareSwap_(p) { return jmRemote_({ fn: "judgeShareSwap_", p: p }); }
function judgeSelfForest_(p) { return jmRemote_({ fn: "judgeSelfForest_", p: p }); }
function judgeClanLand_(p) { return jmRemote_({ fn: "judgeClanLand_", p: p }); }
function judgeReinheritance_(p) { return jmRemote_({ fn: "judgeReinheritance_", p: p }); }
function judgeTrustBeneficiary_(p) { return jmRemote_({ fn: "judgeTrustBeneficiary_", p: p }); }
function judgeSpouseTransfer44_(p) { return jmRemote_({ fn: "judgeSpouseTransfer44_", p: p }); }
function judgeRental9705_(p) { return jmRemote_({ fn: "judgeRental9705_", p: p }); }
function judgeNewHouse99_2_(p) { return jmRemote_({ fn: "judgeNewHouse99_2_", p: p }); }
function judgeLivestockLand_(p) { return jmRemote_({ fn: "judgeLivestockLand_", p: p }); }
function judgeDisasterLoss_(p) { return jmRemote_({ fn: "judgeDisasterLoss_", p: p }); }
function judgeFarmRevival_(p) { return jmRemote_({ fn: "judgeFarmRevival_", p: p }); }
function judgeReplacementHouse_(p) { return jmRemote_({ fn: "judgeReplacementHouse_", p: p }); }
function judgeRuralHouse_(p) { return jmRemote_({ fn: "judgeRuralHouse_", p: p }); }
function judgeAuction_(p) { return jmRemote_({ fn: "judgeAuction_", p: p }); }
function judgeAcquireRight_(p) { return jmRemote_({ fn: "judgeAcquireRight_", p: p }); }
function judgeSuccession_(p) { return jmRemote_({ fn: "judgeSuccession_", p: p }); }
function judgeDefer_(p) { return jmRemote_({ fn: "judgeDefer_", p: p }); }
function judgeRefund_(p) { return jmRemote_({ fn: "judgeRefund_", p: p }); }
function judgeFraud_(p) { return jmRemote_({ fn: "judgeFraud_", p: p }); }
function judgeExclusionPeriod_(p) { return jmRemote_({ fn: "judgeExclusionPeriod_", p: p }); }
function judgeRental9703_(p) { return jmRemote_({ fn: "judgeRental9703_", p: p }); }
function judgeSplitSale_(p) { return jmRemote_({ fn: "judgeSplitSale_", p: p }); }
function judgeGbPurchase_(p) { return jmRemote_({ fn: "judgeGbPurchase_", p: p }); }
function judgeFarmInheritance_(p) { return jmRemote_({ fn: "judgeFarmInheritance_", p: p }); }
function judgeCorpIndividualDeal_(p) { return jmRemote_({ fn: "judgeCorpIndividualDeal_", p: p }); }
function judgeNonResidentTransfer_(p) { return jmRemote_({ fn: "judgeNonResidentTransfer_", p: p }); }
function judgeBurdenedGift_(p) { return jmRemote_({ fn: "judgeBurdenedGift_", p: p }); }
function judgeNewBuildConversion_(p) { return jmRemote_({ fn: "judgeNewBuildConversion_", p: p }); }
function judgeUnregistered_(p) { return jmRemote_({ fn: "judgeUnregistered_", p: p }); }
function judgeFinalReturn_(p) { return jmRemote_({ fn: "judgeFinalReturn_", p: p }); }
function judgeRedevCash_(p) { return jmRemote_({ fn: "judgeRedevCash_", p: p }); }
function judgeDeemedAcq_(p) { return jmRemote_({ fn: "judgeDeemedAcq_", p: p }); }
function judgeHousehold_(p) { return jmRemote_({ fn: "judgeHousehold_", p: p }); }
function judgeSurcharge_(p) { return jmRemote_({ fn: "judgeSurcharge_", p: p }); }
function judgeExpenses_(p) { return jmRemote_({ fn: "judgeExpenses_", p: p }); }
function judgeIsHouse_(p) { return jmRemote_({ fn: "judgeIsHouse_", p: p }); }
function judgeHouseLandExcess_(p) { return jmRemote_({ fn: "judgeHouseLandExcess_", p: p }); }
function judgeTransferTiming_(p) { return jmRemote_({ fn: "judgeTransferTiming_", p: p }); }
function judgeCompensationSplit_(p) { return jmRemote_({ fn: "judgeCompensationSplit_", p: p }); }
function judgeLandReplacement_(p) { return jmRemote_({ fn: "judgeLandReplacement_", p: p }); }
function judgeFarmSwap_(p) { return jmRemote_({ fn: "judgeFarmSwap_", p: p }); }
function judgeRealEstateDealer_(p) { return jmRemote_({ fn: "judgeRealEstateDealer_", p: p }); }
function judgeCoInheritedHouse_(p) { return jmRemote_({ fn: "judgeCoInheritedHouse_", p: p }); }
function judgeMultiHousehold_(p) { return jmRemote_({ fn: "judgeMultiHousehold_", p: p }); }
function judgeInheritDebt_(p) { return jmRemote_({ fn: "judgeInheritDebt_", p: p }); }
function judgeLandBuildingSplit_(p) { return jmRemote_({ fn: "judgeLandBuildingSplit_", p: p }); }
function judgeInheritValuation_(p) { return jmRemote_({ fn: "judgeInheritValuation_", p: p }); }
function judgeGiftTiming_(p) { return jmRemote_({ fn: "judgeGiftTiming_", p: p }); }
function judgeFamilySupportGift_(p) { return jmRemote_({ fn: "judgeFamilySupportGift_", p: p }); }
function judgeTaxAudit_(p) { return jmRemote_({ fn: "judgeTaxAudit_", p: p }); }
function judgeTaxProxyPay_(p) { return jmRemote_({ fn: "judgeTaxProxyPay_", p: p }); }
function judgeBorrowedAccount_(p) { return jmRemote_({ fn: "judgeBorrowedAccount_", p: p }); }
function judgeNomineeRealty_(p) { return jmRemote_({ fn: "judgeNomineeRealty_", p: p }); }
function judgeSecondaryLiability_(p) { return jmRemote_({ fn: "judgeSecondaryLiability_", p: p }); }
function judgeSpecialRelation_(p) { return jmRemote_({ fn: "judgeSpecialRelation_", p: p }); }
function judgeOtherAsset_(p) { return jmRemote_({ fn: "judgeOtherAsset_", p: p }); }
function judgeLimitedAccept_(p) { return jmRemote_({ fn: "judgeLimitedAccept_", p: p }); }
function judgeForeignGift_(p) { return jmRemote_({ fn: "judgeForeignGift_", p: p }); }
function judgeResidency_(p) { return jmRemote_({ fn: "judgeResidency_", p: p }); }
function judgeHeirShares_(p) { return jmRemote_({ fn: "judgeHeirShares_", p: p }); }
function judgeAppealDeadline_(p) { return jmRemote_({ fn: "judgeAppealDeadline_", p: p }); }
function judgeTransferScope_(p) { return jmRemote_({ fn: "judgeTransferScope_", p: p }); }
var jmAnon97_ = function (p) { return jmRemote_({ key: "계약해제", p: p }); };
function judgeSelfFarm_(p) { return jmRemote_({ fn: "judgeSelfFarm_", p: p }); }
function judgeCohabit_(p) { return jmRemote_({ fn: "judgeCohabit_", p: p }); }
function judgeFamilyBiz_(p) { return jmRemote_({ fn: "judgeFamilyBiz_", p: p }); }
function judgeLiquidatorSecondary_(p) { return jmRemote_({ fn: "judgeLiquidatorSecondary_", p: p }); }
function judgeBonusShare_(p) { return jmRemote_({ fn: "judgeBonusShare_", p: p }); }
function judgeDebtSettle_(p) { return jmRemote_({ fn: "judgeDebtSettle_", p: p }); }
function judgeAdversePossession_(p) { return jmRemote_({ fn: "judgeAdversePossession_", p: p }); }
function judgeFamilyLoan_(p) { return jmRemote_({ fn: "judgeFamilyLoan_", p: p }); }
function judgeForeignAssetValuation_(p) { return jmRemote_({ fn: "judgeForeignAssetValuation_", p: p }); }
function judgeArtAntique_(p) { return jmRemote_({ fn: "judgeArtAntique_", p: p }); }
function judgeIntangibleRight_(p) { return jmRemote_({ fn: "judgeIntangibleRight_", p: p }); }
function judgeCorrectionEffect_(p) { return jmRemote_({ fn: "judgeCorrectionEffect_", p: p }); }
function judgeInstallmentPermit_(p) { return jmRemote_({ fn: "judgeInstallmentPermit_", p: p }); }
function judgeEnforcementCollection_(p) { return jmRemote_({ fn: "judgeEnforcementCollection_", p: p }); }
function judgeAppraisalRightSale_(p) { return jmRemote_({ fn: "judgeAppraisalRightSale_", p: p }); }
function judgeStockOption_(p) { return jmRemote_({ fn: "judgeStockOption_", p: p }); }
function judgeEsop_(p) { return jmRemote_({ fn: "judgeEsop_", p: p }); }
function judgePartnershipContribution_(p) { return jmRemote_({ fn: "judgePartnershipContribution_", p: p }); }
function judgeServiceValidity_(p) { return jmRemote_({ fn: "judgeServiceValidity_", p: p }); }
function judgeFilingTimeliness_(p) { return jmRemote_({ fn: "judgeFilingTimeliness_", p: p }); }
function judgeTaxLiabilityTiming_(p) { return jmRemote_({ fn: "judgeTaxLiabilityTiming_", p: p }); }
function judgeGoodFaithReliance_(p) { return jmRemote_({ fn: "judgeGoodFaithReliance_", p: p }); }
function judgeTaxJurisdiction_(p) { return jmRemote_({ fn: "judgeTaxJurisdiction_", p: p }); }
function judgeEstateFollowUpAudit_(p) { return jmRemote_({ fn: "judgeEstateFollowUpAudit_", p: p }); }
function judgeBizAssetSale_(p) { return jmRemote_({ fn: "judgeBizAssetSale_", p: p }); }
function judgeExitTax_(p) { return jmRemote_({ fn: "judgeExitTax_", p: p }); }
function judgeExcessDividend_(p) { return jmRemote_({ fn: "judgeExcessDividend_", p: p }); }
function judgeDisabledTrust_(p) { return jmRemote_({ fn: "judgeDisabledTrust_", p: p }); }
var JUDGE_MORE_ = {
  "인적공제": judgeHeirPersonalDeduction_,
  "일괄공제": judgeHeirPersonalDeduction_,
  "장애인공제": judgeHeirPersonalDeduction_,
  "연로자공제": judgeHeirPersonalDeduction_,
  "미성년자공제": judgeHeirPersonalDeduction_,
  "임대담보평가": judgeLeaseMortgageValuation_,
  "저당평가": judgeLeaseMortgageValuation_,
  "임대료환산": judgeLeaseMortgageValuation_,
  "담보평가": judgeLeaseMortgageValuation_,
  "공동명의": judgeJointOwnership_,
  "지분증여": judgeJointOwnership_,
  "공동명의전환": judgeJointOwnership_,
  "부부공동명의": judgeJointOwnership_,
  "합병의제배당": judgeMergerDividend_,
  "분할의제배당": judgeMergerDividend_,
  "합병대가": judgeMergerDividend_,
  "분할대가": judgeMergerDividend_,
  "합병교부금": judgeMergerDividend_,
  "자기주식": judgeTreasuryStock_,
  "주식소각": judgeTreasuryStock_,
  "배우자증여소각": judgeTreasuryStock_,
  "이익소각": judgeTreasuryStock_,
  "교차증여": judgeCrossGift_,
  "맞바꾼증여": judgeCrossGift_,
  "우회증여": judgeCrossGift_,
  "실질증여자": judgeCrossGift_,
  "사망퇴직금": judgeRetirementDeathPay_,
  "퇴직금등": judgeRetirementDeathPay_,
  "유족연금": judgeRetirementDeathPay_,
  "간주상속퇴직금": judgeRetirementDeathPay_,
  "대여금채권": judgeLoanReceivable_,
  "대여금": judgeLoanReceivable_,
  "채권평가": judgeLoanReceivable_,
  "회수불능채권": judgeLoanReceivable_,
  "보험금과세": judgeInsuranceTax_,
  "보험금": judgeInsuranceTax_,
  "사망보험금": judgeInsuranceTax_,
  "§34": judgeInsuranceTax_,
  "상속추정재산": judgeDisposalPresumption_,
  "처분재산 추정": judgeDisposalPresumption_,
  "상속개시전 처분재산": judgeDisposalPresumption_,
  "§15": judgeDisposalPresumption_,
  "가업승계증여": judgeBizSuccessionGift_,
  "가업승계 증여세 특례": judgeBizSuccessionGift_,
  "가업승계 주식 증여": judgeBizSuccessionGift_,
  "§30의6": judgeBizSuccessionGift_,
  "증여일": judgeGiftAcquisitionDate_,
  "증여재산 취득시기": judgeGiftAcquisitionDate_,
  "증여재산취득시기": judgeGiftAcquisitionDate_,
  "§24": judgeGiftAcquisitionDate_,
  "주식취득분": judgeStockLotMatching_,
  "선입선출": judgeStockLotMatching_,
  "§162⑤": judgeStockLotMatching_,
  "상속외국납부": judgeForeignEstateTaxCredit_,
  "외국납부세액공제": judgeForeignEstateTaxCredit_,
  "§29": judgeForeignEstateTaxCredit_,
  "미분양주택특례": judgeUnsoldHouse_,
  "미분양주택": judgeUnsoldHouse_,
  "준공후미분양": judgeUnsoldHouse_,
  "§98의3": judgeUnsoldHouse_,
  "양도담보물적납세": judgeTransferSecurity_,
  "물적납세의무": judgeTransferSecurity_,
  "양도담보권자": judgeTransferSecurity_,
  "§42": judgeTransferSecurity_,
  "연대납세의무": judgeJointLiability_,
  "연대납세": judgeJointLiability_,
  "§25": judgeJointLiability_,
  "국세우선": judgeTaxPriority_,
  "배당순위": judgeTaxPriority_,
  "§35": judgeTaxPriority_,
  "법인제2차납세의무": judgeCorpSecondary_,
  "법인제2차": judgeCorpSecondary_,
  "§40": judgeConvertibleBond_,
  "사업양수인": judgeBusinessTransferee_,
  "사업양수인제2차납세의무": judgeBusinessTransferee_,
  "§41": judgeBusinessTransferee_,
  "징수권소멸시효": judgeCollectionLimitation_,
  "소멸시효": judgeCollectionLimitation_,
  "국세징수권": judgeCollectionLimitation_,
  "§27": judgeCollectionLimitation_,
  "금융재산공제": judgeFinancialDeduction_,
  "금융재산상속공제": judgeFinancialDeduction_,
  "§22": judgeFinancialDeduction_,
  "추계": judgeEstimatedPrice_,
  "추계결정": judgeEstimatedPrice_,
  "추계취득가액": judgeEstimatedPrice_,
  "§176의2": judgeEstimatedPrice_,
  "후발적경정청구": judgeLateCorrectionClaim_,
  "후발적경정": judgeLateCorrectionClaim_,
  "경정청구사유": judgeLateCorrectionClaim_,
  "§45의2②": judgeLateCorrectionClaim_,
  "납부기한연장": judgePayDeadlineExtension_,
  "납부고지유예": judgePayDeadlineExtension_,
  "징수유예": judgePayDeadlineExtension_,
  "납부기한등연장": judgePayDeadlineExtension_,
  "국세징수법 §13": judgePayDeadlineExtension_,
  "공익신탁": judgePublicTrust_,
  "공익신탁불산입": judgePublicTrust_,
  "공익신탁재산": judgePublicTrust_,
  "§17": judgePublicTrust_,
  "§52": judgePublicTrust_,
  "공익법인사후관리": judgeCharityAftercare_,
  "출연재산사후관리": judgeCharityAftercare_,
  "공익법인 사후관리": judgeCharityAftercare_,
  "§48②": judgeCharityAftercare_,
  "문화유산징수유예": judgeCulturalDeferral_,
  "문화재징수유예": judgeCulturalDeferral_,
  "박물관자료": judgeCulturalDeferral_,
  "§74": judgeCulturalDeferral_,
  "신탁상속": judgeTrustInheritance_,
  "유언대용신탁": judgeTrustInheritance_,
  "수익자연속신탁": judgeTrustInheritance_,
  "신탁 상속": judgeTrustInheritance_,
  "§9": judgeTrustInheritance_,
  "농업법인출자": judgeFarmCorpContribution_,
  "영농조합 현물출자": judgeFarmCorpContribution_,
  "농업회사법인 현물출자": judgeFarmCorpContribution_,
  "§66⑦": judgeFarmCorpContribution_,
  "§68③": judgeFarmCorpContribution_,
  "중소기업통합": judgeIncorp32_,
  "중소기업 간 통합": judgeIncorp32_,
  "§31": judgeIncorp32_,
  "공장이전": judgeFactoryRelocation_,
  "공장 이전 분할납부": judgeFactoryRelocation_,
  "§85의7": judgeFactoryRelocation_,
  "§85의8": judgeFactoryRelocation_,
  "농지교환": judgeFarmlandExchange_,
  "농지 교환": judgeFarmlandExchange_,
  "교환·분합": judgeFarmlandExchange_,
  "§89①2호": judgeFarmlandExchange_,
  "비상장평가": judgeUnlistedValuation_,
  "비상장주식 평가": judgeUnlistedValuation_,
  "순자산가치": judgeUnlistedValuation_,
  "§54": judgeUnlistedValuation_,
  "주식교환": judgeShareSwap_,
  "주식의 포괄적 교환": judgeShareSwap_,
  "포괄적 교환": judgeShareSwap_,
  "§38": judgeShareSwap_,
  "자경산지": judgeSelfForest_,
  "자경산지 감면": judgeSelfForest_,
  "산지 감면": judgeSelfForest_,
  "§69의4": judgeSelfForest_,
  "법인아닌단체": judgeClanLand_,
  "종중": judgeClanLand_,
  "종중 양도": judgeClanLand_,
  "법인 아닌 단체": judgeClanLand_,
  "§2③": judgeClanLand_,
  "재상속": judgeReinheritance_,
  "단기재상속": judgeReinheritance_,
  "§30": judgeReinheritance_,
  "연이은상속": judgeReinheritance_,
  "2차상속": judgeReinheritance_,
  "신탁수익권": judgeTrustBeneficiary_,
  "신탁 수익권": judgeTrustBeneficiary_,
  "수익권양도": judgeTrustBeneficiary_,
  "§94①6호": judgeTrustBeneficiary_,
  "배우자양도추정": judgeSpouseTransfer44_,
  "§44": judgeSpouseTransfer44_,
  "배우자 양도 증여추정": judgeSpouseTransfer44_,
  "우회양도 증여추정": judgeSpouseTransfer44_,
  "장기일반감면": judgeRental9705_,
  "§97의5": judgeRental9705_,
  "97의5": judgeRental9705_,
  "임대주택감면": judgeRental9705_,
  "신축주택감면": judgeNewHouse99_2_,
  "신축주택": judgeNewHouse99_2_,
  "§99의2": judgeNewHouse99_2_,
  "99의2": judgeNewHouse99_2_,
  "2013신축주택": judgeNewHouse99_2_,
  "축사용지": judgeLivestockLand_,
  "축사": judgeLivestockLand_,
  "축사용지감면": judgeLivestockLand_,
  "재해손실": judgeDisasterLoss_,
  "재해손실공제": judgeDisasterLoss_,
  "재난손실": judgeDisasterLoss_,
  "경영회생": judgeFarmRevival_,
  "경영회생 농지": judgeFarmRevival_,
  "농지 환매": judgeFarmRevival_,
  "대체주택": judgeReplacementHouse_,
  "재건축 대체주택": judgeReplacementHouse_,
  "사업기간 대체주택": judgeReplacementHouse_,
  "농어촌주택": judgeRuralHouse_,
  "고향주택": judgeRuralHouse_,
  "농어촌주택특례": judgeRuralHouse_,
  "경매": judgeAuction_,
  "공매": judgeAuction_,
  "경락": judgeAuction_,
  "경매취득": judgeAuction_,
  "부동산권리": judgeAcquireRight_,
  "분양권판정": judgeAcquireRight_,
  "택지공급권": judgeAcquireRight_,
  "지역주택조합": judgeAcquireRight_,
  "납세의무승계": judgeSuccession_,
  "상속인 납세의무": judgeSuccession_,
  "사망 전 양도": judgeSuccession_,
  "납부유예": judgeDefer_,
  "가업납부유예": judgeDefer_,
  "상속세납부유예": judgeDefer_,
  "환급가산금": judgeRefund_,
  "국세환급": judgeRefund_,
  "경정환급": judgeRefund_,
  "부정행위": judgeFraud_,
  "가산세판정": judgeFraud_,
  "신고불성실": judgeFraud_,
  "제척기간": judgeExclusionPeriod_,
  "부과제척기간": judgeExclusionPeriod_,
  "장기임대특례": judgeRental9703_,
  "장기일반민간임대": judgeRental9703_,
  "97의3": judgeRental9703_,
  "나눠팔기": judgeSplitSale_,
  "토지분할양도": judgeSplitSale_,
  "감면한도합산": judgeSplitSale_,
  "개발제한구역": judgeGbPurchase_,
  "개발제한구역감면": judgeGbPurchase_,
  "그린벨트": judgeGbPurchase_,
  "영농상속": judgeFarmInheritance_,
  "영농상속공제": judgeFarmInheritance_,
  "영농 상속": judgeFarmInheritance_,
  "법인거래": judgeCorpIndividualDeal_,
  "법인 거래": judgeCorpIndividualDeal_,
  "가족법인 거래": judgeCorpIndividualDeal_,
  "특수관계법인 거래": judgeCorpIndividualDeal_,
  "비거주자양도": judgeNonResidentTransfer_,
  "비거주자 양도": judgeNonResidentTransfer_,
  "재외국민 양도": judgeNonResidentTransfer_,
  "외국인 양도": judgeNonResidentTransfer_,
  "부담부증여": judgeBurdenedGift_,
  "부담부 증여": judgeBurdenedGift_,
  "채무 인수 증여": judgeBurdenedGift_,
  "환산가산세": judgeNewBuildConversion_,
  "신축 환산 가산세": judgeNewBuildConversion_,
  "감정가액 가산세": judgeNewBuildConversion_,
  "미등기": judgeUnregistered_,
  "미등기양도": judgeUnregistered_,
  "미등기 양도자산": judgeUnregistered_,
  "확정신고": judgeFinalReturn_,
  "확정신고 의무": judgeFinalReturn_,
  "예정신고 합산": judgeFinalReturn_,
  "정비청산": judgeRedevCash_,
  "현금청산": judgeRedevCash_,
  "재개발 현금청산": judgeRedevCash_,
  "매도청구": judgeRedevCash_,
  "의제취득": judgeDeemedAcq_,
  "의제취득일": judgeDeemedAcq_,
  "1985년 전 취득": judgeDeemedAcq_,
  "세대판정": judgeHousehold_,
  "1세대 범위": judgeHousehold_,
  "세대 구성": judgeHousehold_,
  "중과판정": judgeSurcharge_,
  "다주택 중과": judgeSurcharge_,
  "중과 제외": judgeSurcharge_,
  "필요경비": judgeExpenses_,
  "필요경비 판정": judgeExpenses_,
  "자본적지출": judgeExpenses_,
  "주택여부": judgeIsHouse_,
  "주택 해당": judgeIsHouse_,
  "사실상 주거용": judgeIsHouse_,
  "부수토지": judgeHouseLandExcess_,
  "주택부수토지": judgeHouseLandExcess_,
  "부수토지 배율": judgeHouseLandExcess_,
  "양도시기": judgeTransferTiming_,
  "취득시기": judgeTransferTiming_,
  "양도·취득시기": judgeTransferTiming_,
  "보상금구분": judgeCompensationSplit_,
  "수용보상금": judgeCompensationSplit_,
  "보상금 가르기": judgeCompensationSplit_,
  "대토보상": judgeLandReplacement_,
  "대토": judgeFarmSwap_,
  "대토보상 과세이연": judgeLandReplacement_,
  "부동산매매업": judgeRealEstateDealer_,
  "매매업": judgeRealEstateDealer_,
  "부동산 단타": judgeRealEstateDealer_,
  "공동상속": judgeCoInheritedHouse_,
  "공동상속주택": judgeCoInheritedHouse_,
  "공동상속주택 소수지분": judgeCoInheritedHouse_,
  "다가구": judgeMultiHousehold_,
  "다가구주택": judgeMultiHousehold_,
  "다가구 한 채": judgeMultiHousehold_,
  "상속채무": judgeInheritDebt_,
  "상속 채무 공제": judgeInheritDebt_,
  "채무 공과금 장례비": judgeInheritDebt_,
  "토지건물구분": judgeLandBuildingSplit_,
  "일괄양도 안분": judgeLandBuildingSplit_,
  "토지 건물 가액 구분": judgeLandBuildingSplit_,
  "상속평가": judgeInheritValuation_,
  "상속 평가 선택": judgeInheritValuation_,
  "감정평가 신고": judgeInheritValuation_,
  "증여시기": judgeGiftTiming_,
  "증여 날짜": judgeGiftTiming_,
  "증여일 고르기": judgeGiftTiming_,
  "생활비교육비": judgeFamilySupportGift_,
  "비과세증여": judgeFamilySupportGift_,
  "혼인출산공제": judgeFamilySupportGift_,
  "세무조사절차": judgeTaxAudit_,
  "세무조사": judgeTaxAudit_,
  "세무조사 통지": judgeTaxAudit_,
  "세금대납": judgeTaxProxyPay_,
  "상속세 대납": judgeTaxProxyPay_,
  "증여세 대납": judgeTaxProxyPay_,
  "차명계좌": judgeBorrowedAccount_,
  "차명 예금": judgeBorrowedAccount_,
  "차명계좌 증여추정": judgeBorrowedAccount_,
  "부동산명의신탁": judgeNomineeRealty_,
  "명의신탁 부동산": judgeNomineeRealty_,
  "제2차납세의무": judgeSecondaryLiability_,
  "제2차 납세의무": judgeSecondaryLiability_,
  "과점주주": judgeSecondaryLiability_,
  "특별연고자": judgeSpecialRelation_,
  "특별연고자 분여": judgeSpecialRelation_,
  "재산분여": judgeSpecialRelation_,
  "기타자산": judgeOtherAsset_,
  "영업권": judgeOtherAsset_,
  "회원권": judgeOtherAsset_,
  "영업권·회원권": judgeOtherAsset_,
  "한정승인": judgeLimitedAccept_,
  "상속 한정승인": judgeLimitedAccept_,
  "특별한정승인": judgeLimitedAccept_,
  "국외증여": judgeForeignGift_,
  "국외 증여": judgeForeignGift_,
  "국외재산 증여": judgeForeignGift_,
  "거주자": judgeResidency_,
  "거주자 판정": judgeResidency_,
  "비거주자": judgeResidency_,
  "상속인": judgeHeirShares_,
  "법정상속분": judgeHeirShares_,
  "상속인·법정상속분": judgeHeirShares_,
  "불복기한": judgeAppealDeadline_,
  "불복": judgeAppealDeadline_,
  "경정청구기한": judgeAppealDeadline_,
  "양도여부": judgeTransferScope_,
  "계약해제": jmAnon97_,
  "양도로 보지 않음": judgeTransferScope_,
  "농지대토": judgeFarmSwap_,
  "농지대토 감면": judgeFarmSwap_,
  "법인전환": judgeIncorp32_,
  "법인전환 이월과세": judgeIncorp32_,
  "8년자경": judgeSelfFarm_,
  "자경": judgeSelfFarm_,
  "8년 자경농지 감면": judgeSelfFarm_,
  "동거주택": judgeCohabit_,
  "동거주택 상속공제": judgeCohabit_,
  "가업상속": judgeFamilyBiz_,
  "가업상속공제": judgeFamilyBiz_,
  "청산인제2차납세의무": judgeLiquidatorSecondary_,
  "청산인": judgeLiquidatorSecondary_,
  "잔여재산분배": judgeLiquidatorSecondary_,
  "§38①": judgeLiquidatorSecondary_,
  "무상주": judgeBonusShare_,
  "자본전입": judgeBonusShare_,
  "무상증자": judgeBonusShare_,
  "의제배당무상주": judgeBonusShare_,
  "§17②2호": judgeBonusShare_,
  "대물변제": judgeDebtSettle_,
  "위자료": judgeDebtSettle_,
  "채무변제양도": judgeDebtSettle_,
  "양도담보충당": judgeDebtSettle_,
  "시효취득": judgeAdversePossession_,
  "점유취득시효": judgeAdversePossession_,
  "취득시효": judgeAdversePossession_,
  "시효취득양도": judgeAdversePossession_,
  "민법 §245": judgeAdversePossession_,
  "가족차용": judgeFamilyLoan_,
  "차용증": judgeFamilyLoan_,
  "금전무상대출": judgeFamilyLoan_,
  "저리대출": judgeFamilyLoan_,
  "§41의4": judgeFamilyLoan_,
  "담보제공이익": judgeFamilyLoan_,
  "국외재산평가": judgeForeignAssetValuation_,
  "국외재산": judgeForeignAssetValuation_,
  "외국부동산평가": judgeForeignAssetValuation_,
  "외화평가": judgeForeignAssetValuation_,
  "환율평가": judgeForeignAssetValuation_,
  "§58의3": judgeForeignAssetValuation_,
  "§58의4": judgeForeignAssetValuation_,
  "서화골동품": judgeArtAntique_,
  "서화": judgeArtAntique_,
  "골동품": judgeArtAntique_,
  "미술품": judgeArtAntique_,
  "미술품물납": judgeArtAntique_,
  "무체재산권": judgeIntangibleRight_,
  "특허권": judgeIntangibleRight_,
  "상표권": judgeIntangibleRight_,
  "저작권": judgeIntangibleRight_,
  "산업재산권": judgeIntangibleRight_,
  "§59⑤": judgeIntangibleRight_,
  "증액경정": judgeCorrectionEffect_,
  "감액경정": judgeCorrectionEffect_,
  "경정의효력": judgeCorrectionEffect_,
  "경정 효력": judgeCorrectionEffect_,
  "특례제척기간": judgeCorrectionEffect_,
  "재처분": judgeCorrectionEffect_,
  "§22의3": judgeCorrectionEffect_,
  "§26의2⑥": judgeCorrectionEffect_,
  "연부연납": judgeInstallmentPermit_,
  "연부연납허가": judgeInstallmentPermit_,
  "연부연납담보": judgeInstallmentPermit_,
  "연부연납취소": judgeInstallmentPermit_,
  "국세징수법 §18": judgeInstallmentPermit_,
  "강제징수": judgeEnforcementCollection_,
  "체납처분": judgeEnforcementCollection_,
  "압류금지": judgeEnforcementCollection_,
  "급여압류": judgeEnforcementCollection_,
  "공매절차": judgeEnforcementCollection_,
  "압류해제": judgeEnforcementCollection_,
  "국세징수법 §41": judgeEnforcementCollection_,
  "주식매수청구": judgeAppraisalRightSale_,
  "주식매수청구권": judgeAppraisalRightSale_,
  "반대주주": judgeAppraisalRightSale_,
  "매수청구양도": judgeAppraisalRightSale_,
  "§94①3호": judgeAppraisalRightSale_,
  "주식매수선택권": judgeStockOption_,
  "스톡옵션": judgeStockOption_,
  "벤처스톡옵션": judgeStockOption_,
  "선택권행사이익": judgeStockOption_,
  "§16의2": judgeStockOption_,
  "§16의4": judgeStockOption_,
  "우리사주": judgeEsop_,
  "우리사주조합": judgeEsop_,
  "우리사주인출": judgeEsop_,
  "자사주배정": judgeEsop_,
  "§88의4": judgeEsop_,
  "전환사채": judgeConvertibleBond_,
  "전환사채이익": judgeConvertibleBond_,
  "신주인수권부사채": judgeConvertibleBond_,
  "주식전환이익": judgeConvertibleBond_,
  "공동사업출자": judgePartnershipContribution_,
  "동업출자": judgePartnershipContribution_,
  "조합출자": judgePartnershipContribution_,
  "공동사업탈퇴": judgePartnershipContribution_,
  "송달": judgeServiceValidity_,
  "송달적법": judgeServiceValidity_,
  "공시송달": judgeServiceValidity_,
  "전자송달": judgeServiceValidity_,
  "고지서송달": judgeServiceValidity_,
  "국세기본법 §8": judgeServiceValidity_,
  "신고기한특례": judgeFilingTimeliness_,
  "우편신고": judgeFilingTimeliness_,
  "전자신고": judgeFilingTimeliness_,
  "기한특례": judgeFilingTimeliness_,
  "§5의2": judgeFilingTimeliness_,
  "국세기본법 §6": judgeFilingTimeliness_,
  "납세의무성립": judgeTaxLiabilityTiming_,
  "성립시기": judgeTaxLiabilityTiming_,
  "납세의무확정": judgeTaxLiabilityTiming_,
  "적용법령": judgeTaxLiabilityTiming_,
  "소급과세": judgeTaxLiabilityTiming_,
  "§22의2": judgeTaxLiabilityTiming_,
  "신뢰보호": judgeGoodFaithReliance_,
  "신의성실": judgeGoodFaithReliance_,
  "질의회신": judgeGoodFaithReliance_,
  "사전답변": judgeGoodFaithReliance_,
  "공적견해": judgeGoodFaithReliance_,
  "비과세관행": judgeGoodFaithReliance_,
  "§18③": judgeGoodFaithReliance_,
  "납세지": judgeTaxJurisdiction_,
  "과세관할": judgeTaxJurisdiction_,
  "관할세무서": judgeTaxJurisdiction_,
  "신고관할": judgeTaxJurisdiction_,
  "상증법 §6": judgeTaxJurisdiction_,
  "§43②": judgeTaxJurisdiction_,
  "고액상속사후조사": judgeEstateFollowUpAudit_,
  "상속사후조사": judgeEstateFollowUpAudit_,
  "상속인재산증가": judgeEstateFollowUpAudit_,
  "30억상속": judgeEstateFollowUpAudit_,
  "§76⑤": judgeEstateFollowUpAudit_,
  "가업상속자산양도": judgeBizAssetSale_,
  "가업상속자산": judgeBizAssetSale_,
  "가업자산양도": judgeBizAssetSale_,
  "§97의2④": judgeBizAssetSale_,
  "§18의2⑩": judgeBizAssetSale_,
  "국외전출": judgeExitTax_,
  "국외전출세": judgeExitTax_,
  "국외전출자": judgeExitTax_,
  "§118의9": judgeExitTax_,
  "§118의16": judgeExitTax_,
  "초과배당": judgeExcessDividend_,
  "불균등배당": judgeExcessDividend_,
  "배당포기": judgeExcessDividend_,
  "§41의2": judgeExcessDividend_,
  "장애인신탁": judgeDisabledTrust_,
  "장애인 신탁": judgeDisabledTrust_,
  "자익신탁": judgeDisabledTrust_,
  "타익신탁": judgeDisabledTrust_,
  "§52의2": judgeDisabledTrust_
};
function judgeOutOfScope_(r) {
  const lines = [].concat(r.알림 || [], r.할일 || [], r.확인할것 || [], [r.표시 || '']).map(String).filter(function (t) { return !/(아님|아니|없음|안 됨|과세 안|해당 없|부과분 제외|비교 밖|건강보험)/.test(t) || /따로|별도|넣어/.test(t); });
  const txt = lines.join(' '), out = [];
  if (/법인세/.test(txt)) out.push('법인세');
  if (/종합소득세|사업소득|기타소득|의제배당|배당소득|근로소득|상여/.test(txt)) out.push('종합소득세');
  return out;
}
function judgeMoreRun_(c, input, by) {
  const kind = String(input.묶음 || input.group || ''), fn = JUDGE_MORE_[kind.replace(/\s+/g, ' ').trim()] || JUDGE_MORE_[kind.replace(/\s/g, '')];
  if (!fn) return { ok: false, error: '없는 묶음: ' + kind + ' — find_judgment(판정 찾기)로 맞는 묶음 이름을 찾을 것(지금 부를 수 있는 이름 ' + Object.keys(JUDGE_MORE_).length + '개, 판정 창 목록과 같음)' }; // [2026.11.11] 손으로 적은 묶음 목록이 새 묶음 23개를 빠뜨려 낡았던 것 — 개수만 그때그때
  let r, facts = input.facts || input.사실 || {}, mapNote = '';
  // [2026.11.04 큰일 ⑦] 법인 이름이 있으면 가족 지도 지분을 먼저 읽는다 — 칸에 넣은 값이 있으면 그 값이 우선
  if (typeof famCorpFill_ === 'function' && c && (fn === JUDGE_MORE_['제2차납세의무'] || fn === JUDGE_MORE_['법인거래'])) {
    try { const fl = famCorpFill_(c, fn === JUDGE_MORE_['제2차납세의무'] ? '제2차' : '가족지분', facts); if (fl.채움.length) { facts = fl.facts; mapNote = '가족 지도에서 채운 칸: ' + fl.채움.join('·') + ' — ' + fl.지도.출처 + ' (주주명부·주식변동상황명세서로 확인할 것)'; } } catch (e) { mapNote = '⚠ 가족 지도 지분을 읽지 못함: ' + String(e && e.message || e); }
  }
  // [2026.11.11 판정 사실 잇기 다] 사건이 있으면 넥스가 불러도 화면 판정 창처럼 장부·지난 판정 값으로 빈 칸을 먼저 채운다(넘긴 값이 우선).
  //  세무사님 11-11 "판정할때 필요한 데이타는 어떻게 확보하나?" → "당장 고쳐라" — 예전엔 넥스가 장부를 읽어 손으로 옮겨야 했음
  const filled = {}, filledProv = [];
  if (c && c.id && input.prefill !== false && typeof judgePrefill_ === 'function') {
    try {
      const pf = judgePrefill_(c, { 묶음: kind, objectId: input.objectId || input.물건 || '' });
      if (pf && pf.ok && pf.답 && pf.답.length) mapNote = (mapNote ? mapNote + ' · ' : '') + '장부에 들어온 답 ' + pf.답.length + '개(이 판정이 물었던 것): ' + pf.답.map(function (x) { return x.요건 + ' → ' + String(x.답).slice(0, 40); }).join(' / ').slice(0, 400) + ' — 사실 칸에 옮겨 다시 판정할 것';
      if (pf && pf.ok) Object.keys(pf.값 || {}).forEach(function (k) {
        if (facts[k] != null && facts[k] !== '') return;
        if (facts === (input.facts || input.사실)) facts = Object.assign({}, facts);
        facts[k] = pf.값[k]; filled[k] = (pf.출처 || {})[k] || '장부';
        if (/잠정/.test(filled[k])) filledProv.push(k);
      });
    } catch (e) { mapNote = (mapNote ? mapNote + ' · ' : '') + '⚠ 장부 값으로 칸을 채우지 못함: ' + String(e && e.message || e).slice(0, 100); }
  }
  try { r = fn(facts); } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  if (filledProv.length && r && !r.잠정) r.잠정 = true; // 장부에서 확정 안 된 값으로 판정했으면 결론도 잠정
  const out = { ok: true, 결과: r, 넣은사실: facts, 알림: (mapNote ? [mapNote] : []).concat(r.알림 || []) };
  // [2026.11.11 판정 도구 점검] 엔진칸을 내면서 그 뜻(어느 계산에 어떻게 넣나)을 안 적은 판정이 14가지 — 넥스가 계산기로 넘기는 길을 늘 같이 알린다
  const ekeys_ = r && r.엔진칸 && typeof r.엔진칸 === 'object' ? Object.keys(r.엔진칸).filter(function (k) { return r.엔진칸[k] !== undefined; }) : []; // 값 없는 칸은 넥스에게 가는 글에서도 빠짐
  if (ekeys_.length && !r.엔진칸뜻) {
    out.알림.push('엔진칸 ' + ekeys_.slice(0, 12).join('·') + ' — 세액 엔진 입력 이름 그대로입니다. 사건 계산(case_ledger 계산의 over — 양도는 path 「a0.칸 이름」처럼 자산 번호를 붙이고, 증여·상속은 칸 이름 그대로)이나 계산 도구 입력에 넣어 돌리고, 결론이 잠정이면 경우(안)으로 저장' + (r.잠정 ? '(지금 잠정)' : ''));
  }
  if (Object.keys(filled).length) {
    out.장부에서채운칸 = filled;
    out.알림.unshift('장부에서 채운 칸 ' + Object.keys(filled).length + '개: ' + Object.keys(filled).map(function (k) { return k + '(' + String(filled[k]).replace(/^장부 /, '') + ')'; }).join(' · ').slice(0, 400) + (filledProv.length ? ' — 확정 안 된 값이 있어 결론은 잠정' : ''));
  }
  if (input.write === false) { out.장부 = '보기만 — 장부에 넣지 않음'; return out; }
  const who = String(by || '세무사님').slice(0, 6);
  try {
    ledgerMutate_(c.id, function (L) {
      L.judge = L.judge || {};
      const oid = String(input.objectId || input.물건 || '');
      // [2026.11.02 쪼개 처리 ③] 물건이 여럿이면 물건마다 따로 남긴다(같은 묶음을 두 물건에 돌리면 앞 결과를 덮던 것) — 열쇠 = 묶음@물건id
      L.judge[r.묶음 + (oid ? '@' + oid : '')] = { 결론: r.결론, 잠정: r.잠정, 표시: r.표시, 엔진칸: (r.결론 === '충족' || r.엔진칸늘) ? r.엔진칸 : {}, 요건: r.요건, 할일: r.할일 || [], 기한: (typeof awDeadlinesFromResult_ === 'function' ? awDeadlinesFromResult_(r) : []), 때: caseProcNow_(), 누가: who, 사실: facts, 물건: oid };
      out.판정열쇠 = 'judge.' + r.묶음 + (oid ? '@' + oid : ''); // 자문 항목 calc·links에 이 열쇠를 넣으면 요약에 판정 결과가 풀려 나온다
      const o = oid && L.obj && Array.isArray(L.obj.list) ? L.obj.list.filter(function (x) { return x && x.id === oid; })[0] : null;
      if (o) { const one = { 묶음: r.묶음, 결론: r.결론, 잠정: !!r.잠정, 남은것: (r.남은것 || []).slice(0, 12), 표시: r.표시, 때: caseProcNow_(), 누가: who }; const list = (o.판정 && Array.isArray(o.판정.묶음들) ? o.판정.묶음들 : []).filter(function (x) { return x && x.묶음 !== r.묶음; }).concat([one]); o.판정 = Object.assign({}, o.판정 || one, { 묶음들: list }); out.물건 = o.id; }
      // [2026.11.04 판단거리 ①] 법인세·종합소득세(사업·기타·배당 소득 등)는 이 시스템 계산 범위 밖 — 판정 글에 그 몫이 나오면 장부 여쭐 것에 한 줄 세움(계산은 세무사님 값으로)
      const oos = judgeOutOfScope_(r);
      if (oos.length) { const qp = 'q:범위밖:' + r.묶음 + (oid ? '@' + oid : ''); ledgerAskInner_(L, qp, { label: '범위 밖 세금 — ' + oos.join('·'), question: '이 몫은 ' + oos.join('·') + ' — 이 도구 계산 범위 밖입니다. 세무사님 계산값을 넣어 주세요(판정: ' + r.묶음 + ')', by: 'GAS', keep: true }); out.알림.push('범위 밖 세금(' + oos.join('·') + ') — 장부 여쭐 것에 올림'); }
      // [2026.11.11 판정 사실 잇기 가] 판정이 모르는 사실(요건 결과 「?」)은 장부 「여쭐 것」 또는 「받을 서류」로 세운다 — 판정 → 묻기·서류 요청 → 장부 → 다시 판정.
      //  예전엔 남은 것이 판정 결과 속에만 남아 고객 질문·서류 요청으로 이어지지 않았다. 다시 돌려 풀린 요건의 물음은 거둔다(답이 들어온 줄은 그대로).
      try { out.세운물음 = judgeAskSync_(L, r, oid, who); } catch (e) { out.알림.push('여쭐 것을 세우지 못함: ' + e.message); }
      ledgerLogTo_(L, { by: who, what: '종합판정', path: 'judge.' + r.묶음 + (oid ? '@' + oid : ''), detail: r.표시.slice(0, 200) });
    });
    out.장부 = '판정 기록 — 장부 계산(상속)이 충족이면 엔진칸을 넣고, 잠정·안 됨이면 넣지 않음' + (r.묶음 === '8년 자경농지 감면' ? ' · 양도는 계산 가정(over)으로 isEightYearFarmland를 주어 경우(안)로 견줄 것' : '');
  } catch (e) { out.알림.push('판정 기록 못 남김: ' + e.message); }
  return out;
}
var JUDGE_CATALOG_STATIC_ = [{"묶음":"1세대1주택","이름":"1세대1주택 비과세","별칭":["1세대1주택","비과세","고가주택","일시적 2주택"],"무리":"주택","칸":[],"근거":["소득세법 §89①3호","시행령 §154~§156의2"],"따로창":"taxRelief"},{"묶음":"인적공제","이름":"인적공제","별칭":["인적공제","일괄공제","장애인공제","연로자공제","미성년자공제"],"무리":"기타","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"사람","종류":"목록"},{"이름":"피상속인거주자","종류":"예아니오"},{"이름":"신고","종류":"글"},{"이름":"배우자단독","종류":"예아니오"}],"근거":[],"함수":"judgeHeirPersonalDeduction_"},{"묶음":"임대담보평가","이름":"임대담보평가","별칭":["임대담보평가","저당평가","임대료환산","담보평가"],"무리":"주택","칸":[{"이름":"시가","종류":"글"},{"이름":"토지기준시가","종류":"글"},{"이름":"건물기준시가","종류":"글"},{"이름":"보충적평가액","종류":"숫자"},{"이름":"임대","종류":"목록"},{"이름":"보증금","종류":"숫자"},{"이름":"월세","종류":"글"},{"이름":"담보","종류":"목록"},{"이름":"지분","종류":"숫자"},{"이름":"증여일","종류":"날짜"},{"이름":"신용보증","종류":"글"},{"이름":"토지건물소유자같음","종류":"예아니오"},{"이름":"관계","종류":"글"},{"이름":"인수채무","종류":"숫자"},{"이름":"인수채무증빙","종류":"예아니오"}],"근거":[],"함수":"judgeLeaseMortgageValuation_"},{"묶음":"공동명의","이름":"공동명의","별칭":["공동명의","지분증여","공동명의전환","부부공동명의"],"무리":"상속증여","칸":[{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"증여일","종류":"날짜"},{"이름":"증여자사망일","종류":"날짜"},{"이름":"나중양도일","종류":"날짜"},{"이름":"증여지분","종류":"숫자"},{"이름":"증여재산가액","종류":"숫자"},{"이름":"앞선배우자증여","종류":"글"},{"이름":"일세대일주택","종류":"예아니오"},{"이름":"거주연수","종류":"숫자"},{"이름":"수증자거주연수","종류":"숫자"},{"이름":"증여세산출세액","종류":"숫자"}],"근거":[],"함수":"judgeJointOwnership_"},{"묶음":"합병의제배당","이름":"합병의제배당","별칭":["합병의제배당","분할의제배당","합병대가","분할대가","합병교부금"],"무리":"기타","칸":[{"이름":"갈래","종류":"글"},{"이름":"적격","종류":"예아니오"},{"이름":"등기일","종류":"날짜"},{"이름":"주주들","종류":"목록"},{"이름":"존속","종류":"예아니오"}],"근거":[],"함수":"judgeMergerDividend_"},{"묶음":"자기주식","이름":"자기주식","별칭":["자기주식","주식소각","배우자증여소각","이익소각"],"무리":"상속증여","칸":[{"이름":"회사","종류":"묶음","속칸":["중소기업"]},{"이름":"정황","종류":"묶음"},{"이름":"거래들","종류":"목록"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeTreasuryStock_"},{"묶음":"교차증여","이름":"교차증여","별칭":["교차증여","맞바꾼증여","우회증여","실질증여자"],"무리":"상속증여","칸":[{"이름":"증여들","종류":"목록"},{"이름":"정황","종류":"묶음","속칸":["같은때","금액비슷","서로약속","자금맞바꿈","다른이유"]},{"이름":"앞선증여들","종류":"목록"}],"근거":[],"함수":"judgeCrossGift_"},{"묶음":"사망퇴직금","이름":"사망퇴직금","별칭":["사망퇴직금","퇴직금등","유족연금","간주상속퇴직금"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"지급들","종류":"목록","속칸":["이름","금액","정기금평가액","연금형","지급근거법","명칭","업무상사망","받는사람"]},{"이름":"상속기본","종류":"묶음","속칸":["taxableEstateAmount"]}],"근거":[],"함수":"judgeRetirementDeathPay_"},{"묶음":"대여금채권","이름":"대여금채권","별칭":["대여금채권","대여금","채권평가","회수불능채권"],"무리":"기타","칸":[{"이름":"평가기준일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"증여일","종류":"날짜"},{"이름":"채권들","종류":"목록","속칸":["이름","원본","약정이자율","관계","대여일","만기일","마지막이자일","채권내용변경","기간없음","종류","회수불능사유","회수불능증빙"]},{"이름":"상속기본","종류":"묶음","속칸":["taxableEstateAmount"]}],"근거":[],"함수":"judgeLoanReceivable_"},{"묶음":"보험금과세","이름":"보험금과세","별칭":["보험금과세","보험금","사망보험금","§34"],"무리":"기타","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"피상속인","종류":"글"},{"이름":"계약들","종류":"목록","속칸":["이름","보험금","납부","계약자","총보험료","사고","피보험자","사고일","수익자","수익자장애인"]},{"이름":"상속기본","종류":"묶음","속칸":["taxableEstateAmount","generationSkipHeirRatio","grossEstateValue"]}],"근거":[],"함수":"judgeInsuranceTax_"},{"묶음":"상속추정재산","이름":"상속추정재산","별칭":["상속추정재산","처분재산 추정","상속개시전 처분재산","§15"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"거래들","종류":"목록","속칸":["구분","내용","날짜","금액","재예입","재산종류","받은돈"]}],"근거":[],"함수":"judgeDisposalPresumption_"},{"묶음":"가업승계증여","이름":"가업승계증여","별칭":["가업승계증여","가업승계 증여세 특례","가업승계 주식 증여","§30의6"],"무리":"기한","칸":[{"이름":"증여일","종류":"날짜"},{"이름":"수증자나이","종류":"글"},{"이름":"증여자나이","종류":"글"},{"이름":"수증자거주자","종류":"예아니오"},{"이름":"증여자관계","종류":"글"},{"이름":"기업규모","종류":"글"},{"이름":"중견3년평균매출","종류":"글"},{"이름":"계속경영연수","종류":"숫자"},{"이름":"상장","종류":"예아니오"},{"이름":"증여자지분율","종류":"숫자"},{"이름":"지분보유연수","종류":"숫자"},{"이름":"대표재직연수","종류":"숫자"},{"이름":"영위연수","종류":"숫자"},{"이름":"최근10년대표연수","종류":"숫자"},{"이름":"최대주주등에게서","종류":"예아니오"},{"이름":"종사시작일","종류":"날짜"},{"이름":"대표취임일","종류":"날짜"},{"이름":"처벌","종류":"예아니오"},{"이름":"결정일","종류":"날짜"},{"이름":"처벌확정일","종류":"날짜"},{"이름":"창업자금특례받음","종류":"예아니오"},{"이름":"주식가액","종류":"숫자"},{"이름":"총자산","종류":"글"},{"이름":"사업무관자산","종류":"글"},{"이름":"앞선특례증여가액","종류":"숫자"},{"이름":"같은날다른승계자가액","종류":"숫자"},{"이름":"앞선특례세액","종류":"숫자"},{"이름":"사후사건","종류":"목록"}],"근거":[],"함수":"judgeBizSuccessionGift_"},{"묶음":"증여일","이름":"증여일","별칭":["증여일","증여재산 취득시기","증여재산취득시기","§24"],"무리":"기한","칸":[{"이름":"증여자관계","종류":"글"},{"이름":"수증자생년월일","종류":"날짜"},{"이름":"재산들","종류":"목록","속칸":["이름","가액","종류","계약일","특례조문"]},{"이름":"앞선증여들","종류":"목록","속칸":["증여일","금액","증여자","과세표준","낸세액","날"]},{"이름":"세대생략","종류":"예아니오"},{"이름":"다른직계존속공제씀","종류":"글"},{"이름":"실제신고일","종류":"날짜"}],"근거":[],"함수":"judgeGiftAcquisitionDate_"},{"묶음":"주식취득분","이름":"주식취득분","별칭":["주식취득분","선입선출","§162⑤"],"무리":"기타","칸":[{"이름":"대주주","종류":"예아니오"},{"이름":"중소기업","종류":"예아니오"},{"이름":"취득구분분명","종류":"예아니오"},{"이름":"상장장내소액","종류":"예아니오"},{"이름":"매수","종류":"목록","속칸":["주수","방법","취득가액","평가액","취득일","행사시가","옛주식취득총액"]},{"이름":"양도","종류":"목록","속칸":["양도일","주수","양도가액","양도비용","지정회차"]},{"이름":"공휴일","종류":"목록"},{"이름":"종목","종류":"글"}],"근거":[],"함수":"judgeStockLotMatching_"},{"묶음":"상속외국납부","이름":"상속외국납부","별칭":["상속외국납부","외국납부세액공제","§29"],"무리":"상속증여","칸":[{"이름":"피상속인거주자","종류":"예아니오"},{"이름":"우리과세표준","종류":"글"},{"이름":"산출세액","종류":"숫자"},{"이름":"증여세액공제","종류":"글"},{"이름":"나라들","종류":"목록","속칸":["외국납부세액","외국과세표준","나라","세종류","국외분과세표준"]},{"이름":"상속개시일","종류":"날짜"},{"이름":"피상속인외국주소","종류":"예아니오"},{"이름":"상속인외국주소","종류":"예아니오"},{"이름":"공휴일","종류":"목록"}],"근거":[],"함수":"judgeForeignEstateTaxCredit_"},{"묶음":"미분양주택특례","이름":"미분양주택특례","별칭":["미분양주택특례","미분양주택","준공후미분양","§98의3"],"무리":"주택","칸":[{"이름":"계약일","종류":"날짜"},{"이름":"계약금납부일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"납세자","종류":"글"},{"이름":"국내사업장","종류":"글"},{"이름":"소재지","종류":"글"},{"이름":"상대방","종류":"글"},{"이름":"기준일미분양","종류":"예아니오"},{"이름":"준공후미분양","종류":"예아니오"},{"이름":"입주사실","종류":"예아니오"},{"이름":"해제재계약","종류":"예아니오"},{"이름":"대체계약","종류":"예아니오"},{"이름":"취득가액","종류":"숫자"},{"이름":"전용면적","종류":"숫자"},{"이름":"대지면적","종류":"숫자"},{"이름":"분양공고가","종류":"글"},{"이름":"계약가","종류":"글"},{"이름":"임대","종류":"묶음","속칸":["누가","계약일","연수","등록일"]},{"이름":"산출세액","종류":"숫자"},{"이름":"조합원","종류":"예아니오"},{"이름":"1세대1주택","종류":"글"},{"이름":"조문","종류":"글"},{"이름":"자기건설","종류":"예아니오"}],"근거":[],"함수":"judgeUnsoldHouse_"},{"묶음":"양도담보물적납세","이름":"양도담보물적납세","별칭":["양도담보물적납세","물적납세의무","양도담보권자","§42"],"무리":"기타","칸":[{"이름":"재산","종류":"묶음","속칸":["담보설정일","가액","확정귀속일","담보의사","피담보채권"]},{"이름":"고지발송일","종류":"날짜"},{"이름":"국세들","종류":"목록","속칸":["금액","세목"]},{"이름":"강제징수비","종류":"글"},{"이름":"다른재산징수액","종류":"숫자"},{"이름":"특수관계","종류":"예아니오"},{"이름":"담보권자","종류":"글"},{"이름":"납세자","종류":"글"}],"근거":[],"함수":"judgeTransferSecurity_"},{"묶음":"연대납세의무","이름":"연대납세의무","별칭":["연대납세의무","연대납세","§25"],"무리":"상속증여","칸":[{"이름":"원인","종류":"글"},{"이름":"사람들","종류":"목록","속칸":["이름","금액","지분","승계재산가액"]},{"이름":"세금들","종류":"목록","속칸":["금액","이름","지분","승계재산가액"]},{"이름":"분할등기일","종류":"날짜"},{"이름":"본인","종류":"글"}],"근거":[],"함수":"judgeJointLiability_"},{"묶음":"국세우선","이름":"국세우선","별칭":["국세우선","배당순위","§35"],"무리":"기타","칸":[{"이름":"매각대금","종류":"글"},{"이름":"매각허가결정일","종류":"날짜"},{"이름":"국세들","종류":"목록","속칸":["확정","압류등기일","확정일","고지발송일","신고일","세목","금액","당해세","압류"]},{"이름":"권리들","종류":"목록","속칸":["날짜","누구","종류","주거용","금액","특수관계"]},{"이름":"재산종류","종류":"글"},{"이름":"이전일","종류":"날짜"},{"이름":"직전보유자","종류":"묶음","속칸":["보유전전세권등","체납들"]},{"이름":"양도상속증여후","종류":"글"},{"이름":"집행비용","종류":"글"},{"이름":"최우선소액보증금","종류":"숫자"},{"이름":"최우선임금","종류":"글"}],"근거":[],"함수":"judgeTaxPriority_"},{"묶음":"법인제2차납세의무","이름":"법인제2차납세의무","별칭":["법인제2차납세의무","법인제2차"],"무리":"상속증여","칸":[{"이름":"납부기간만료일","종류":"날짜"},{"이름":"체납액","종류":"숫자"},{"이름":"출자자종류","종류":"글"},{"이름":"집단지분","종류":"숫자"},{"이름":"경영지배","종류":"글"},{"이름":"출자자재산","종류":"글"},{"이름":"사유","종류":"글"},{"이름":"심판계속중","종류":"글"},{"이름":"정관양도제한내용","종류":"글"},{"이름":"출자자주식","종류":"글"},{"이름":"발행주식","종류":"글"},{"이름":"법인자산시가","종류":"글"},{"이름":"법인부채시가","종류":"글"},{"이름":"법인자산장부","종류":"글"},{"이름":"법인부채장부","종류":"글"}],"근거":[],"함수":"judgeCorpSecondary_"},{"묶음":"§40","이름":"전환사채","별칭":["§40","전환사채","전환사채이익","신주인수권부사채","주식전환이익"],"무리":"기타","칸":[{"이름":"단계","종류":"글"},{"이름":"법인","종류":"묶음"},{"이름":"당사자","종류":"묶음"},{"이름":"전환사채","종류":"묶음"},{"이름":"전환","종류":"묶음"},{"이름":"양도","종류":"묶음"},{"이름":"직전1년이익들","종류":"목록"},{"이름":"역방향","종류":"묶음"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeConvertibleBond_"},{"묶음":"사업양수인","이름":"사업양수인","별칭":["사업양수인","사업양수인제2차납세의무","§41"],"무리":"상속증여","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"양수사업장","종류":"글"},{"이름":"사업장","종류":"글"},{"이름":"세금","종류":"목록"},{"이름":"포괄승계","종류":"글"},{"이름":"특수관계","종류":"글"},{"이름":"조세회피목적","종류":"글"},{"이름":"양도인충당후부족액","종류":"숫자"},{"이름":"지급액","종류":"숫자"},{"이름":"시가","종류":"글"},{"이름":"평가자산","종류":"글"},{"이름":"평가부채","종류":"글"},{"이름":"양수인들","종류":"목록","속칸":["이름","몫"]}],"근거":[],"함수":"judgeBusinessTransferee_"},{"묶음":"징수권소멸시효","이름":"징수권소멸시효","별칭":["징수권소멸시효","소멸시효","국세징수권","§27"],"무리":"기타","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"세금","종류":"목록"},{"이름":"사건","종류":"목록"}],"근거":[],"함수":"judgeCollectionLimitation_"},{"묶음":"금융재산공제","이름":"금융재산공제","별칭":["금융재산공제","금융재산상속공제","§22"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"거주자","종류":"예아니오"},{"이름":"공휴일","종류":"목록"},{"이름":"재산","종류":"목록"},{"이름":"채무","종류":"목록"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeFinancialDeduction_"},{"묶음":"추계","이름":"추계","별칭":["추계","추계결정","추계취득가액","§176의2"],"무리":"기타","칸":[{"이름":"거래","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"자산","종류":"글"},{"이름":"결정주체","종류":"글"},{"이름":"기준시가양도","종류":"글"},{"이름":"기준시가취득","종류":"글"},{"이름":"양도가액","종류":"숫자"},{"이름":"엔진칸","종류":"묶음"},{"이름":"전소유자확인","종류":"예아니오"},{"이름":"전소유자가액","종류":"숫자"},{"이름":"전소유자경정","종류":"예아니오"},{"이름":"전소유자비과세고가","종류":"예아니오"},{"이름":"장부","종류":"글"},{"이름":"후보","종류":"목록"},{"이름":"등기부기재가액","종류":"숫자"},{"이름":"신고","종류":"글"}],"근거":[],"함수":"judgeEstimatedPrice_"},{"묶음":"후발적경정청구","이름":"후발적경정청구","별칭":["후발적경정청구","후발적경정","경정청구사유","§45의2②"],"무리":"기타","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"신고","종류":"글"},{"이름":"결정받음","종류":"예아니오"},{"이름":"사유","종류":"목록"},{"이름":"엔진","종류":"글"},{"이름":"당초엔진칸","종류":"글"},{"이름":"반영엔진칸","종류":"글"}],"근거":[],"함수":"judgeLateCorrectionClaim_"},{"묶음":"납부기한연장","이름":"납부기한연장","별칭":["납부기한연장","납부고지유예","징수유예","납부기한등연장","국세징수법 §13"],"무리":"기한","칸":[{"이름":"종류","종류":"글"},{"이름":"세액","종류":"숫자"},{"이름":"기한","종류":"날짜"},{"이름":"사유","종류":"글"},{"이름":"신청일","종류":"날짜"},{"이름":"통지결과","종류":"글"},{"이름":"통지일","종류":"날짜"},{"이름":"연장월수","종류":"숫자"},{"이름":"특별재난지역등","종류":"예아니오"},{"이름":"세목","종류":"글"},{"이름":"담보종류","종류":"글"},{"이름":"담보가액","종류":"숫자"},{"이름":"담보예외","종류":"예아니오"},{"이름":"취소사유","종류":"글"},{"이름":"고지서발송일","종류":"날짜"},{"이름":"고지서도달일","종류":"날짜"}],"근거":[],"함수":"judgePayDeadlineExtension_"},{"묶음":"공익신탁","이름":"공익신탁","별칭":["공익신탁","공익신탁불산입","공익신탁재산","§17","§52"],"무리":"상속증여","칸":[{"이름":"세목","종류":"글"},{"이름":"증여일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"비거주","종류":"예아니오"},{"이름":"신탁","종류":"목록"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgePublicTrust_"},{"묶음":"공익법인사후관리","이름":"공익법인사후관리","별칭":["공익법인사후관리","출연재산사후관리","공익법인 사후관리","§48②"],"무리":"상속증여","칸":[{"이름":"종교단체","종류":"예아니오"},{"이름":"위반","종류":"목록"},{"이름":"불산입받음","종류":"예아니오"}],"근거":[],"함수":"judgeCharityAftercare_"},{"묶음":"문화유산징수유예","이름":"문화유산징수유예","별칭":["문화유산징수유예","문화재징수유예","박물관자료","§74"],"무리":"기타","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"재산","종류":"목록"},{"이름":"담보","종류":"예아니오"},{"이름":"비거주","종류":"예아니오"},{"이름":"엔진칸","종류":"묶음"},{"이름":"상속재산총액","종류":"숫자"}],"근거":[],"함수":"judgeCulturalDeferral_"},{"묶음":"신탁상속","이름":"신탁상속","별칭":["신탁상속","유언대용신탁","수익자연속신탁","신탁 상속","§9"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"신탁","종류":"목록"},{"이름":"엔진칸","종류":"묶음"},{"이름":"배우자다른상속액","종류":"숫자"}],"근거":[],"함수":"judgeTrustInheritance_"},{"묶음":"농업법인출자","이름":"농업법인 현물출자 이월과세(§66⑦)","별칭":["농업법인출자","영농조합 현물출자","농업회사법인 현물출자","§66⑦","§68③"],"무리":"감면","칸":[{"이름":"출자일","종류":"날짜"},{"이름":"법인종류","종류":"글"},{"이름":"농업인","종류":"묶음","속칸":["거주","경작연수","소득기준넘은해수"]},{"이름":"자산","종류":"목록"},{"이름":"농업법인","종류":"예아니오"},{"이름":"신청","종류":"글"},{"이름":"세액","종류":"숫자"},{"이름":"직전감면세액","종류":"숫자"},{"이름":"처분","종류":"목록"},{"이름":"이미낸세액","종류":"숫자"},{"이름":"납부일","종류":"날짜"}],"근거":[],"함수":"judgeFarmCorpContribution_"},{"묶음":"중소기업통합","이름":"법인전환 이월과세","별칭":["중소기업통합","중소기업 간 통합","§31","법인전환","법인전환 이월과세"],"무리":"감면","칸":[{"이름":"전환방법","종류":"글"},{"이름":"특례","종류":"글"},{"이름":"중소기업","종류":"예아니오"},{"이름":"소비성서비스업","종류":"예아니오"},{"이름":"업종","종류":"글"},{"이름":"주된자산모두승계","종류":"예아니오"},{"이름":"통합법인주주","종류":"예아니오"},{"이름":"통합법인설립일","종류":"날짜"},{"이름":"통합일","종류":"날짜"},{"이름":"과점주주","종류":"예아니오"},{"이름":"자산","종류":"목록"},{"이름":"부채","종류":"숫자"},{"이름":"자본금","종류":"숫자"},{"이름":"받은주식가액","종류":"숫자"},{"이름":"법인설립일","종류":"날짜"},{"이름":"설립등기일","종류":"날짜"},{"이름":"발기인출자","종류":"예아니오"},{"이름":"사업양도일","종류":"날짜"},{"이름":"현물출자일","종류":"날짜"},{"이름":"적용신청","종류":"글"},{"이름":"처분","종류":"목록"}],"근거":[],"함수":"judgeIncorp32_"},{"묶음":"공장이전","이름":"중소기업 공장 이전 분할납부(§85의8)","별칭":["공장이전","공장 이전 분할납부","§85의7","§85의8"],"무리":"감면","칸":[{"이름":"기존공장","종류":"묶음","속칸":["가동시작","토지취득일","산업단지","양도가액","기준면적초과비율","양도차익"]},{"이름":"신규공장","종류":"묶음","속칸":["소재","시행지역안","사업시행자직접취득","산업단지","같은산업단지","사업개시일","취득가액","예정가액"]},{"이름":"양도일","종류":"날짜"},{"이름":"사업인정고시일","종류":"날짜"},{"이름":"특례","종류":"글"},{"이름":"공장","종류":"예아니오"},{"이름":"양수자","종류":"글"},{"이름":"중소기업","종류":"예아니오"},{"이름":"부득이사유","종류":"예아니오"},{"이름":"이전안함","종류":"예아니오"},{"이름":"세액","종류":"숫자"},{"이름":"폐업일","종류":"날짜"},{"이름":"오늘","종류":"날짜"},{"이름":"거래","종류":"묶음"}],"근거":[],"함수":"judgeFactoryRelocation_"},{"묶음":"농지교환","이름":"농지 교환 비과세","별칭":["농지교환","농지 교환","교환·분합","§89①2호"],"무리":"토지","칸":[{"이름":"넘긴농지","종류":"묶음","속칸":["농지","시가","지역","용도지역","편입일","단서가","단서나","환지예정지지정일","환지예정지농지밖","취득가액","필요경비","취득일"]},{"이름":"받은농지","종류":"묶음","속칸":["농지","시가"]},{"이름":"정산금","종류":"묶음","속칸":["받음","줌"]},{"이름":"경작","종류":"묶음","속칸":["시작","끝","거주지역","수용일","사망일","상속인계속경작","상속인경작끝"]},{"이름":"교환일","종류":"날짜"},{"이름":"사유","종류":"글"},{"이름":"오늘","종류":"날짜"}],"근거":[],"함수":"judgeFarmlandExchange_"},{"묶음":"비상장평가","이름":"비상장주식 평가","별칭":["비상장평가","비상장주식 평가","순자산가치","§54"],"무리":"상속증여","칸":[{"이름":"회사","종류":"묶음","속칸":["순손익","주식수","발행주식수","분할전사업개시일","사업개시일","자산총액","부동산등가액","주식등가액","존속기한","청산중","계속곤란","휴업폐업"]},{"이름":"주주","종류":"묶음","속칸":["평가할주식수","최대주주","명의신탁","최대주주지위상실"]},{"이름":"추정이익","종류":"묶음","속칸":["일시우발사건","평가기관수","산정기준일","작성일","신고"]},{"이름":"시가","종류":"묶음","속칸":["금액","종류","날짜"]},{"이름":"원인","종류":"글"},{"이름":"평가기준일","종류":"날짜"}],"근거":[],"함수":"judgeUnlistedValuation_"},{"묶음":"주식교환","이름":"주식교환","별칭":["주식교환","주식의 포괄적 교환","포괄적 교환","§38"],"무리":"감면","칸":[{"이름":"교환","종류":"묶음","속칸":["교환일","부득이사유","모회사신설","종류","양법인1년사업","지분대로배정","자회사사업계속","고정자산절반처분","사업연도말"]},{"이름":"주주","종류":"묶음","속칸":["취득가액","지배주주","지분율","지분시가","대주주","중소기업"]},{"이름":"대가","종류":"묶음","속칸":["모회사주식가액","금전등","모회사주식수"]},{"이름":"모회사사전취득","종류":"묶음","속칸":["지배주주"]},{"이름":"보유","종류":"묶음","속칸":["모회사","주주"]},{"이름":"엔진칸","종류":"묶음"},{"이름":"폐업","종류":"묶음","속칸":["날짜","부득이"]},{"이름":"처분","종류":"목록","속칸":["날짜","주식수","양도가액","부득이"]}],"근거":[],"함수":"judgeShareSwap_"},{"묶음":"자경산지","이름":"자경산지 감면","별칭":["자경산지","자경산지 감면","산지 감면","§69의4"],"무리":"토지","칸":[{"이름":"산지","종류":"묶음","속칸":["취득일","인가일","양도일","보전산지","주거지역편입일","도시지역","부득이사유","환지예정지지정일","양도가액","취득가액","필요경비","기준시가"]},{"이름":"사람","종류":"묶음","속칸":["임업인","양도일거주자","비거주된날","거주지역","경영방법","거주연수"]},{"이름":"상속","종류":"묶음","속칸":["상속받은날","상속후경영개월","지정지역3년안"]},{"이름":"경영","종류":"목록"},{"이름":"소득초과해","종류":"묶음"},{"이름":"직접경영연수","종류":"숫자"},{"이름":"엔진칸","종류":"묶음"},{"이름":"직전감면","종류":"글"}],"근거":[],"함수":"judgeSelfForest_"},{"묶음":"법인아닌단체","이름":"법인아닌단체","별칭":["법인아닌단체","종중","종중 양도","법인 아닌 단체","§2③"],"무리":"토지","칸":[{"이름":"단체","종류":"묶음","속칸":["이름","주무관청허가등록","공익재단","법인승인","종류"]},{"이름":"이름","종류":"글"},{"이름":"토지","종류":"묶음","속칸":["종류","취득일","양도일","양도가액","취득가액","필요경비","비사업용토지","등기명의"]},{"이름":"분배","종류":"묶음","속칸":["비율정함","사실상분배","구성원"]},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeClanLand_"},{"묶음":"재상속","이름":"재상속","별칭":["재상속","단기재상속","§30","연이은상속","2차상속"],"무리":"상속증여","칸":[{"이름":"전상속개시일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"이번피상속인지위","종류":"글"},{"이름":"전상속세산출세액","종류":"숫자"},{"이름":"전상속재산가액","종류":"숫자"},{"이름":"전상속세과세가액","종류":"숫자"},{"이름":"재상속재산","종류":"목록"},{"이름":"이번피상속인몫전상속세","종류":"글"},{"이름":"사망전납부액","종류":"숫자"},{"이름":"전배우자분할","종류":"예아니오"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeReinheritance_"},{"묶음":"신탁수익권","이름":"신탁수익권","별칭":["신탁수익권","신탁 수익권","수익권양도","§94①6호"],"무리":"기타","칸":[{"이름":"수익권","종류":"묶음","속칸":["종류"]},{"이름":"종류","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"양도비용","종류":"글"},{"이름":"같은해쓴기본공제","종류":"글"},{"이름":"지배이전","종류":"묶음","속칸":["위탁자지위이전","수익권전부","해지권처분지시권이전"]},{"이름":"위탁자통제","종류":"묶음","속칸":["해지권","수익자변경권","잔여재산귀속","원본은위탁자","수익자배우자등"]},{"이름":"양도인지위","종류":"글"},{"이름":"신탁재산","종류":"묶음","속칸":["자산","양도가액","취득가액","취득일"]},{"이름":"엔진칸","종류":"묶음"},{"이름":"양수인관계","종류":"글"}],"근거":[],"함수":"judgeTrustBeneficiary_"},{"묶음":"배우자양도추정","이름":"배우자양도추정","별칭":["배우자양도추정","§44","배우자 양도 증여추정","우회양도 증여추정"],"무리":"상속증여","칸":[{"이름":"우회","종류":"묶음","속칸":["최종양수인관계","재양도시가","재양도대가","재양도일","당초양도일","중간특수관계","중간관계","당초양도자결정세액","양수자결정세액","비교증여세","당초양도가액"]},{"이름":"관계","종류":"글"},{"이름":"시가","종류":"글"},{"이름":"대가","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"자산","종류":"글"},{"이름":"취득가액","종류":"숫자"},{"이름":"취득일","종류":"날짜"},{"이름":"양도비용","종류":"글"},{"이름":"처분방식","종류":"글"},{"이름":"수증자거주자","종류":"예아니오"},{"이름":"수증자10년안증여","종류":"글"},{"이름":"대가출처","종류":"목록"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeSpouseTransfer44_"},{"묶음":"장기일반감면","이름":"장기일반감면","별칭":["장기일반감면","§97의5","97의5","임대주택감면"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"등록일","종류":"날짜"},{"이름":"임대개시일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"계약일","종류":"날짜"},{"이름":"말소일","종류":"날짜"},{"이름":"말소사유","종류":"글"},{"이름":"종류","종류":"글"},{"이름":"아파트","종류":"예아니오"},{"이름":"거주자","종류":"예아니오"},{"이름":"계약","종류":"목록","속칸":["시작","끝","보증금","월세","s"]},{"이름":"재개발","종류":"글"},{"이름":"수용","종류":"글"},{"이름":"상속","종류":"묶음","속칸":["피상속인임대일수"]},{"이름":"기준시가","종류":"묶음","속칸":["취득","양도","임대끝","등록"]},{"이름":"바탕","종류":"글"},{"이름":"임대개시기준시가","종류":"숫자"}],"근거":[],"함수":"judgeRental9705_"},{"묶음":"신축주택감면","이름":"신축주택감면","별칭":["신축주택감면","신축주택","§99의2","99의2","2013신축주택"],"무리":"주택","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"주택","종류":"묶음","속칸":["종류","공급자","계약일","계약금지급일","취득일","사용승인일","최초계약","선착순","재개발조합원","멸실재건축","실거래가액","면적"]},{"이름":"해제","종류":"묶음"},{"이름":"기존주택","종류":"묶음"},{"이름":"오피스텔","종류":"묶음"},{"이름":"양도","종류":"묶음"},{"이름":"기준시가","종류":"묶음"}],"근거":[],"함수":"judgeNewHouse99_2_"},{"묶음":"축사용지","이름":"축사용지","별칭":["축사용지","축사","축사용지감면"],"무리":"토지","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"양도인","종류":"묶음","속칸":["거주자","비거주된날","거주지역","거주년수","직접축산","축산년수"]},{"이름":"토지","종류":"묶음"},{"이름":"상속","종류":"묶음"},{"이름":"대토","종류":"묶음"},{"이름":"폐업","종류":"묶음"},{"이름":"양도","종류":"묶음"},{"이름":"재축산","종류":"묶음"}],"근거":[],"함수":"judgeLivestockLand_"},{"묶음":"재해손실","이름":"재해손실","별칭":["재해손실","재해손실공제","재난손실"],"무리":"상속증여","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"종류","종류":"글"},{"이름":"증여일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"기산일","종류":"날짜"},{"이름":"외국주소","종류":"예아니오"},{"이름":"피상속인거주자","종류":"예아니오"},{"이름":"재산","종류":"목록","속칸":["이름","평가액","재난일","재난종류","손실가액","손실비율","남은가액","보험금","구상가능액"]},{"이름":"엔진기본","종류":"묶음"},{"이름":"증여가액","종류":"숫자"},{"이름":"관계","종류":"글"},{"이름":"과세가액","종류":"숫자"},{"이름":"재산총액","종류":"숫자"},{"이름":"배우자","종류":"예아니오"},{"이름":"자녀수","종류":"글"}],"근거":[],"함수":"judgeDisasterLoss_"},{"묶음":"경영회생","이름":"경영회생","별칭":["경영회생","경영회생 농지","농지 환매"],"무리":"토지","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"양도인","종류":"묶음","속칸":["농업인","직접경작"]},{"이름":"공사양도","종류":"묶음"},{"이름":"임차","종류":"묶음"},{"이름":"환매","종류":"묶음"},{"이름":"사망","종류":"묶음"},{"이름":"원래","종류":"묶음"},{"이름":"재양도","종류":"묶음"}],"근거":[],"함수":"judgeFarmRevival_"},{"묶음":"대체주택","이름":"대체주택","별칭":["대체주택","재건축 대체주택","사업기간 대체주택"],"무리":"주택","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"사업","종류":"묶음","속칸":["사업시행인가일","완성일","완성예정일","종류"]},{"이름":"대체주택","종류":"묶음"},{"이름":"이사","종류":"묶음"},{"이름":"취득때주택수","종류":"숫자"},{"이름":"조정대상지역","종류":"예아니오"}],"근거":[],"함수":"judgeReplacementHouse_"},{"묶음":"농어촌주택","이름":"농어촌주택","별칭":["농어촌주택","고향주택","농어촌주택특례"],"무리":"주택","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"종류","종류":"글"},{"이름":"일반주택","종류":"묶음","속칸":["취득일","양도일","소재지","양도가액","취득가액","필요경비"]},{"이름":"농어촌주택","종류":"묶음"},{"이름":"소재지","종류":"묶음"},{"이름":"고향","종류":"묶음"},{"이름":"같은연접","종류":"글"},{"이름":"다른주택","종류":"글"}],"근거":[],"함수":"judgeRuralHouse_"},{"묶음":"경매","이름":"경매","별칭":["경매","공매","경락","경매취득"],"무리":"토지","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"양도","종류":"목록"},{"이름":"취득","종류":"목록"}],"근거":[],"함수":"judgeAuction_"},{"묶음":"부동산권리","이름":"부동산권리","별칭":["부동산권리","분양권판정","택지공급권","지역주택조합"],"무리":"주택","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"권리","종류":"목록"}],"근거":[],"함수":"judgeAcquireRight_"},{"묶음":"납세의무승계","이름":"납세의무승계","별칭":["납세의무승계","상속인 납세의무","사망 전 양도"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"거래","종류":"목록","속칸":["잔금일","등기일","이름","양도가액","받은대금","양도세","신고"]},{"이름":"체납","종류":"목록"},{"이름":"상속인","종류":"목록"}],"근거":[],"함수":"judgeSuccession_"},{"묶음":"납부유예","이름":"납부유예","별칭":["납부유예","가업납부유예","상속세납부유예"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"비거주","종류":"예아니오"},{"이름":"중소기업","종류":"예아니오"},{"이름":"가업상속공제","종류":"예아니오"},{"이름":"영농상속공제","종류":"예아니오"},{"이름":"담보","종류":"예아니오"},{"이름":"상속세납부세액","종류":"숫자"},{"이름":"가업상속재산가액","종류":"숫자"},{"이름":"총상속재산가액","종류":"숫자"},{"이름":"다시유예","종류":"예아니오"},{"이름":"사유","종류":"목록","속칸":["일","종류","정당한사유","처분비율"]},{"이름":"고용","종류":"묶음","속칸":["정규직평균비율","총급여평균비율"]}],"근거":[],"함수":"judgeDefer_"},{"묶음":"환급가산금","이름":"환급가산금","별칭":["환급가산금","국세환급","경정환급"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"원인","종류":"글"},{"이름":"환급세액","종류":"숫자"},{"이름":"고충민원","종류":"예아니오"},{"이름":"납부","종류":"목록","속칸":["일","금액"]},{"이름":"원천징수납부액","종류":"숫자"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"감면결정일","종류":"날짜"},{"이름":"법개정시행일","종류":"날짜"},{"이름":"경정청구일","종류":"날짜"},{"이름":"결정일","종류":"날짜"},{"이름":"지급일","종류":"날짜"},{"이름":"불복확정일","종류":"날짜"},{"이름":"충당","종류":"목록","속칸":["종류","동의","금액","이름"]},{"이름":"세목","종류":"글"}],"근거":[],"함수":"judgeRefund_"},{"묶음":"부정행위","이름":"부정행위","별칭":["부정행위","가산세판정","신고불성실"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"세목","종류":"글"},{"이름":"역외","종류":"예아니오"},{"이름":"신고","종류":"예아니오"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"거래일","종류":"날짜"},{"이름":"항목","종류":"목록","속칸":["이름","과세표준","행위","이유"]},{"이름":"과소과세표준","종류":"글"},{"이름":"신고할세액","종류":"숫자"},{"이름":"신고한세액","종류":"숫자"},{"이름":"정당한사유","종류":"예아니오"},{"이름":"경정예지","종류":"예아니오"},{"이름":"수정신고일","종류":"날짜"},{"이름":"기한후신고일","종류":"날짜"},{"이름":"정당한사유내용","종류":"글"},{"이름":"납부한세액","종류":"숫자"},{"이름":"납부일","종류":"날짜"},{"이름":"고지일","종류":"날짜"}],"근거":[],"함수":"judgeFraud_"},{"묶음":"제척기간","이름":"제척기간","별칭":["제척기간","부과제척기간"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"건","종류":"목록","속칸":["이름","세목","거래일","신고","부정행위","거짓누락","누락유형","역외","신고기한","비거주"]}],"근거":[],"함수":"judgeExclusionPeriod_"},{"묶음":"장기임대특례","이름":"장기임대특례","별칭":["장기임대특례","장기일반민간임대","97의3"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"등록일","종류":"날짜"},{"이름":"임대개시일","종류":"날짜"},{"이름":"말소일","종류":"날짜"},{"이름":"말소사유","종류":"글"},{"이름":"종류","종류":"글"},{"이름":"아파트","종류":"예아니오"},{"이름":"등록신청일","종류":"날짜"},{"이름":"단기변경일","종류":"날짜"},{"이름":"거주자","종류":"예아니오"},{"이름":"계약","종류":"목록","속칸":["시작","끝","보증금","월세","s","e"]},{"이름":"재개발","종류":"글"},{"이름":"상속","종류":"묶음","속칸":["피상속인임대일수"]},{"이름":"전환율","종류":"숫자"},{"이름":"전용면적","종류":"숫자"},{"이름":"읍면","종류":"예아니오"},{"이름":"계약일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"수도권","종류":"예아니오"},{"이름":"임대개시기준시가","종류":"글"},{"이름":"바탕","종류":"글"}],"근거":[],"함수":"judgeRental9703_"},{"묶음":"나눠팔기","이름":"나눠팔기","별칭":["나눠팔기","토지분할양도","감면한도합산"],"무리":"토지","칸":[{"이름":"이번","종류":"묶음","속칸":["양도일","산사람"]},{"이름":"앞선","종류":"목록","속칸":["양도일","분할일","지분","감면세액"]},{"이름":"바탕","종류":"글"}],"근거":[],"함수":"judgeSplitSale_"},{"묶음":"개발제한구역","이름":"개발제한구역","별칭":["개발제한구역","개발제한구역감면","그린벨트"],"무리":"토지","칸":[{"이름":"방식","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"지정일","종류":"날짜"},{"이름":"해제일","종류":"날짜"},{"이름":"사업인정고시일","종류":"날짜"},{"이름":"먼저지정일","종류":"날짜"},{"이름":"먼저지정","종류":"글"},{"이름":"매수청구일","종류":"날짜"},{"이름":"협의매수일","종류":"날짜"},{"이름":"취득원인","종류":"글"},{"이름":"취득일","종류":"날짜"},{"이름":"피상속인취득일","종류":"날짜"},{"이름":"거주","종류":"목록"},{"이름":"부득이","종류":"목록","속칸":["시작","끝","사유","s","e"]},{"이름":"자경8년","종류":"예아니오"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"비사업용","종류":"예아니오"},{"이름":"채권","종류":"예아니오"},{"이름":"직접경작","종류":"예아니오"}],"근거":[],"함수":"judgeGbPurchase_"},{"묶음":"영농상속","이름":"영농상속","별칭":["영농상속","영농상속공제","영농 상속"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"형태","종류":"글"},{"이름":"피상속인","종류":"묶음","속칸":["거주","직접영농","경영시작일","영농","중단","최대주주지분","사망나이","생년월일","부득이사망"]},{"이름":"상속인","종류":"묶음"},{"이름":"포탈형확정","종류":"예아니오"},{"이름":"재산","종류":"목록","속칸":["가액","담보채무","영농사용시작일","종류","가업공제"]},{"이름":"주식가액","종류":"숫자"},{"이름":"사업관련비율","종류":"숫자"},{"이름":"사후","종류":"묶음","속칸":["처분일","미종사일","정당사유","처분가액"]},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeFarmInheritance_"},{"묶음":"법인거래","이름":"법인거래","별칭":["법인거래","법인 거래","가족법인 거래","특수관계법인 거래"],"무리":"기타","칸":[{"이름":"방향","종류":"글"},{"이름":"특수관계","종류":"예아니오"},{"이름":"처분","종류":"예아니오"},{"이름":"정당사유","종류":"예아니오"},{"이름":"대가","종류":"글"},{"이름":"시가","종류":"글"},{"이름":"처분금액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"양도비용","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"자산","종류":"글"},{"이름":"처분종류","종류":"글"},{"이름":"주주가족지분","종류":"숫자"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeCorpIndividualDeal_"},{"묶음":"비거주자양도","이름":"비거주자양도","별칭":["비거주자양도","비거주자 양도","재외국민 양도","외국인 양도"],"무리":"상속증여","칸":[{"이름":"거주자","종류":"글"},{"이름":"신분","종류":"글"},{"이름":"출국사유","종류":"글"},{"이름":"자산","종류":"글"},{"이름":"매수인","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"잔금일","종류":"날짜"},{"이름":"출국일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"양도비용","종류":"글"},{"이름":"1세대1주택","종류":"글"},{"이름":"출국일1주택","종류":"예아니오"},{"이름":"취득가액확인","종류":"예아니오"},{"이름":"먼저낸세액","종류":"숫자"},{"이름":"확인서제출","종류":"예아니오"},{"이름":"납세관리인","종류":"예아니오"},{"이름":"엔진칸","종류":"묶음"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeNonResidentTransfer_"},{"묶음":"부담부증여","이름":"부담부증여","별칭":["부담부증여","부담부 증여","채무 인수 증여"],"무리":"상속증여","칸":[{"이름":"관계","종류":"글"},{"이름":"채무종류","종류":"글"},{"이름":"입증","종류":"글"},{"이름":"평가방법","종류":"글"},{"이름":"채무액","종류":"숫자"},{"이름":"평가액","종류":"숫자"},{"이름":"다른재산가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"증여일","종류":"날짜"},{"이름":"채무담보관련","종류":"예아니오"},{"이름":"인수","종류":"예아니오"},{"이름":"취득가액","종류":"숫자"},{"이름":"취득당시기준시가","종류":"글"},{"이름":"엔진칸증여","종류":"묶음","속칸":["relation"]},{"이름":"증여자1세대1주택","종류":"예아니오"},{"이름":"재산종류","종류":"글"},{"이름":"상환능력","종류":"예아니오"},{"이름":"채무발생일","종류":"날짜"}],"근거":[],"함수":"judgeBurdenedGift_"},{"묶음":"환산가산세","이름":"환산가산세","별칭":["환산가산세","신축 환산 가산세","감정가액 가산세"],"무리":"기한","칸":[{"이름":"건물취득원인","종류":"글"},{"이름":"취득가액방법","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"엔진칸","종류":"묶음"},{"이름":"증축면적","종류":"숫자"},{"이름":"증축일","종류":"날짜"},{"이름":"무허가","종류":"예아니오"},{"이름":"사실상사용일","종류":"날짜"},{"이름":"사용승인일","종류":"날짜"},{"이름":"임시사용승인일","종류":"날짜"},{"이름":"공사비증빙","종류":"예아니오"},{"이름":"증축분가액","종류":"숫자"},{"이름":"건물분가액","종류":"숫자"}],"근거":[],"함수":"judgeNewBuildConversion_"},{"묶음":"미등기","이름":"미등기","별칭":["미등기","미등기양도","미등기 양도자산"],"무리":"토지","칸":[{"이름":"자산","종류":"글"},{"이름":"취득원인","종류":"글"},{"이름":"사유","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"엔진칸","종류":"묶음"},{"이름":"등기","종류":"예아니오"},{"이름":"사유설명","종류":"글"},{"이름":"자경8년","종류":"예아니오"},{"이름":"농지대토","종류":"예아니오"},{"이름":"농지교환","종류":"예아니오"},{"이름":"건축허가","종류":"글"},{"이름":"일세대일주택","종류":"예아니오"},{"이름":"환지처분공고일","종류":"날짜"},{"이름":"건설사업자","종류":"예아니오"}],"근거":[],"함수":"judgeUnregistered_"},{"묶음":"확정신고","이름":"확정신고","별칭":["확정신고","확정신고 의무","예정신고 합산"],"무리":"기한","칸":[{"이름":"거래","종류":"목록"},{"이름":"연도","종류":"글"},{"이름":"토지허가일","종류":"날짜"},{"이름":"합산산출세액","종류":"숫자"},{"이름":"납부일","종류":"날짜"},{"이름":"확정신고","종류":"예아니오"}],"근거":[],"함수":"judgeFinalReturn_"},{"묶음":"정비청산","이름":"정비청산","별칭":["정비청산","현금청산","재개발 현금청산","매도청구"],"무리":"토지","칸":[{"이름":"사업","종류":"글"},{"이름":"방식","종류":"글"},{"이름":"상대","종류":"글"},{"이름":"분양신청","종류":"글"},{"이름":"잔금일","종류":"날짜"},{"이름":"등기접수일","종류":"날짜"},{"이름":"수용개시일","종류":"날짜"},{"이름":"판결확정일","종류":"날짜"},{"이름":"공탁소송","종류":"예아니오"},{"이름":"정비기반시설","종류":"예아니오"},{"이름":"고시일","종류":"날짜"},{"이름":"앞사람취득일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"취득원인","종류":"글"},{"이름":"이월과세","종류":"예아니오"},{"이름":"멸실일","종류":"날짜"},{"이름":"주택","종류":"예아니오"},{"이름":"일주택","종류":"예아니오"},{"이름":"청산금","종류":"글"},{"이름":"지연이자","종류":"글"},{"이름":"이주비","종류":"글"},{"이름":"주거이전비","종류":"글"},{"이름":"이사비","종류":"글"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"채권","종류":"예아니오"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeRedevCash_"},{"묶음":"의제취득","이름":"의제취득","별칭":["의제취득","의제취득일","1985년 전 취득"],"무리":"토지","칸":[{"이름":"자산","종류":"글"},{"이름":"취득일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"양도기준시가","종류":"글"},{"이름":"의제기준시가","종류":"글"},{"이름":"의제매매사례","종류":"글"},{"이름":"의제감정","종류":"글"},{"이름":"실지취득가액","종류":"숫자"},{"이름":"물가상승률","종류":"글"},{"이름":"물가지수","종류":"묶음","속칸":["취득","의제직전"]},{"이름":"실가근거","종류":"글"},{"이름":"취득원인","종류":"글"},{"이름":"미등기","종류":"예아니오"},{"이름":"필요경비","종류":"글"}],"근거":[],"함수":"judgeDeemedAcq_"},{"묶음":"세대판정","이름":"세대판정","별칭":["세대판정","1세대 범위","세대 구성"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"배우자","종류":"묶음","속칸":["있음","주택","같은주소","사실상이혼"]},{"이름":"본인주택","종류":"글"},{"이름":"양도할","종류":"글"},{"이름":"가족","종류":"목록"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득일","종류":"날짜"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeHousehold_"},{"묶음":"중과판정","이름":"중과판정","별칭":["중과판정","다주택 중과","중과 제외"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"주택","종류":"목록"},{"이름":"조정대상지역","종류":"예아니오"},{"이름":"혼인일","종류":"날짜"},{"이름":"배우자주택수","종류":"숫자"},{"이름":"혼인뒤취득일","종류":"날짜"},{"이름":"양도할","종류":"글"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득일","종류":"날짜"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"계약일","종류":"날짜"}],"근거":[],"함수":"judgeSurcharge_"},{"묶음":"필요경비","이름":"필요경비","별칭":["필요경비","필요경비 판정","자본적지출"],"무리":"토지","칸":[{"이름":"항목","종류":"목록"},{"이름":"보상금증액","종류":"숫자"},{"이름":"감가상각누계","종류":"글"},{"이름":"취득가액","종류":"숫자"},{"이름":"양도가액","종류":"숫자"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"자산","종류":"글"}],"근거":[],"함수":"judgeExpenses_"},{"묶음":"주택여부","이름":"주택여부","별칭":["주택여부","주택 해당","사실상 주거용"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"건물","종류":"목록"},{"이름":"양도할","종류":"글"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득일","종류":"날짜"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeIsHouse_"},{"묶음":"부수토지","이름":"부수토지","별칭":["부수토지","주택부수토지","부수토지 배율"],"무리":"주택","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"매매계약일","종류":"날짜"},{"이름":"멸실일","종류":"날짜"},{"이름":"토지면적","종류":"숫자"},{"이름":"정착면적","종류":"숫자"},{"이름":"수용","종류":"예아니오"},{"이름":"고시전날용도지역","종류":"글"},{"이름":"용도지역","종류":"글"},{"이름":"주택상태","종류":"글"},{"이름":"계약따라변경","종류":"예아니오"},{"이름":"부수토지만양도","종류":"예아니오"},{"이름":"건물소유세대","종류":"글"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"토지비율","종류":"숫자"},{"이름":"토지양도가액","종류":"숫자"},{"이름":"토지취득가액","종류":"숫자"},{"이름":"1세대1주택","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeHouseLandExcess_"},{"묶음":"양도시기","이름":"양도시기","별칭":["양도시기","취득시기","양도·취득시기"],"무리":"기한","칸":[{"이름":"양도","종류":"묶음"},{"이름":"취득","종류":"묶음"},{"이름":"자산종류","종류":"글"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"1세대1주택","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeTransferTiming_"},{"묶음":"보상금구분","이름":"보상금구분","별칭":["보상금구분","수용보상금","보상금 가르기"],"무리":"토지","칸":[{"이름":"항목","종류":"목록"},{"이름":"사업자","종류":"예아니오"},{"이름":"사업인정고시일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"보상방식","종류":"글"},{"이름":"비사업용토지","종류":"예아니오"},{"이름":"직전감면77","종류":"글"},{"이름":"복식부기","종류":"예아니오"},{"이름":"판결확정일","종류":"날짜"}],"근거":[],"함수":"judgeCompensationSplit_"},{"묶음":"대토보상","이름":"대토보상","별칭":["대토보상","대토보상 과세이연"],"무리":"토지","칸":[{"이름":"사업인정고시일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"총보상액","종류":"숫자"},{"이름":"대토보상액","종류":"숫자"},{"이름":"채권보상액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"비사업용토지","종류":"예아니오"},{"이름":"직전감면77","종류":"글"},{"이름":"채권종류","종류":"글"},{"이름":"대토양도가액","종류":"숫자"},{"이름":"대토양도일","종류":"날짜"},{"이름":"대토등기일","종류":"날짜"},{"이름":"대토필요경비","종류":"글"},{"이름":"사유","종류":"글"},{"이름":"사유일","종류":"날짜"},{"이름":"납부일","종류":"날짜"}],"근거":[],"함수":"judgeLandReplacement_"},{"묶음":"대토","이름":"농지대토 감면","별칭":["대토","농지대토","농지대토 감면"],"무리":"토지","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"기준일","종류":"날짜"},{"이름":"수용","종류":"예아니오"},{"이름":"소득초과해","종류":"목록"},{"이름":"종전거주지역","종류":"글"},{"이름":"종전거주년수","종류":"숫자"},{"이름":"양도일거주자","종류":"예아니오"},{"이름":"직접경작","종류":"예아니오"},{"이름":"종전경작","종류":"목록","속칸":["시작","끝"]},{"이름":"새취득일","종류":"날짜"},{"이름":"새취득원인","종류":"글"},{"이름":"종전면적","종류":"숫자"},{"이름":"새면적","종류":"숫자"},{"이름":"종전가액","종류":"숫자"},{"이름":"새가액","종류":"숫자"},{"이름":"새경작시작일","종류":"날짜"},{"이름":"부득이사유","종류":"예아니오"},{"이름":"새거주지역","종류":"글"},{"이름":"새농지수용일","종류":"날짜"},{"이름":"소유자사망일","종류":"날짜"},{"이름":"새경작끝","종류":"날짜"},{"이름":"상속인계속경작","종류":"예아니오"},{"이름":"종전편입일","종류":"날짜"},{"이름":"종전편입시지역","종류":"글"},{"이름":"종전환지예정지지정일","종류":"날짜"},{"이름":"새편입일","종류":"날짜"},{"이름":"새편입시지역","종류":"글"}],"근거":[],"함수":"judgeFarmSwap_"},{"묶음":"부동산매매업","이름":"부동산매매업","별칭":["부동산매매업","매매업","부동산 단타"],"무리":"기타","칸":[{"이름":"거래","종류":"목록"},{"이름":"사업자등록","종류":"예아니오"},{"이름":"판매목적","종류":"예아니오"},{"이름":"과세연도","종류":"글"},{"이름":"사업경비","종류":"글"},{"이름":"소득공제","종류":"글"},{"이름":"이월결손금","종류":"글"},{"이름":"다른종합소득금액","종류":"숫자"}],"근거":[],"함수":"judgeRealEstateDealer_"},{"묶음":"공동상속","이름":"공동상속","별칭":["공동상속","공동상속주택","공동상속주택 소수지분"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"공동상속주택이름","종류":"글"},{"이름":"피상속인주택","종류":"목록"},{"이름":"상속인","종류":"목록"},{"이름":"납세자","종류":"글"},{"이름":"양도주택","종류":"글"},{"이름":"다른주택수","종류":"숫자"},{"이름":"일반주택취득일","종류":"날짜"},{"이름":"일반주택증여2년","종류":"예아니오"},{"이름":"양도가액","종류":"숫자"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"취득가액","종류":"숫자"},{"이름":"필요경비","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeCoInheritedHouse_"},{"묶음":"다가구","이름":"다가구","별칭":["다가구","다가구주택","다가구 한 채"],"무리":"주택","칸":[{"이름":"대장용도","종류":"글"},{"이름":"구분등기","종류":"예아니오"},{"이름":"필로티주차","종류":"예아니오"},{"이름":"대장주택층수","종류":"숫자"},{"이름":"실제주택층수","종류":"숫자"},{"이름":"주택바닥면적","종류":"숫자"},{"이름":"실제세대수","종류":"숫자"},{"이름":"세대수","종류":"숫자"},{"이름":"양도방식","종류":"글"},{"이름":"주택연면적","종류":"숫자"},{"이름":"주택외연면적","종류":"숫자"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"다른주택수","종류":"숫자"},{"이름":"보유2년","종류":"예아니오"},{"이름":"거주2년","종류":"예아니오"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"필요경비","종류":"글"},{"이름":"거주연수","종류":"숫자"}],"근거":[],"함수":"judgeMultiHousehold_"},{"묶음":"상속채무","이름":"상속채무","별칭":["상속채무","상속 채무 공제","채무 공과금 장례비"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"채무","종류":"목록","속칸":["종류","금액","증빙","발생일","이름","받는사람상속인"]},{"이름":"장례비","종류":"글"},{"이름":"장례비증빙","종류":"예아니오"},{"이름":"봉안비","종류":"글"},{"이름":"상속재산","종류":"글"},{"이름":"사전증여","종류":"글"},{"이름":"배우자","종류":"예아니오"},{"이름":"자녀수","종류":"글"},{"이름":"배우자실제상속액","종류":"숫자"}],"근거":[],"함수":"judgeInheritDebt_"},{"묶음":"토지건물구분","이름":"토지건물구분","별칭":["토지건물구분","일괄양도 안분","토지 건물 가액 구분"],"무리":"토지","칸":[{"이름":"예외","종류":"글"},{"이름":"양도","종류":"글"},{"이름":"취득","종류":"묶음"},{"이름":"토지비사업용","종류":"예아니오"},{"이름":"주택","종류":"예아니오"},{"이름":"특수관계","종류":"예아니오"}],"근거":[],"함수":"judgeLandBuildingSplit_"},{"묶음":"상속평가","이름":"상속평가","별칭":["상속평가","상속 평가 선택","감정평가 신고"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"기준일","종류":"날짜"},{"이름":"대상","종류":"목록"},{"이름":"다른재산과세가액","종류":"숫자"},{"이름":"배우자","종류":"예아니오"},{"이름":"자녀수","종류":"글"},{"이름":"순금융재산","종류":"글"},{"이름":"배우자실제상속액","종류":"숫자"}],"근거":[],"함수":"judgeInheritValuation_"},{"묶음":"증여시기","이름":"증여시기","별칭":["증여시기","증여 날짜","증여일 고르기"],"무리":"기한","칸":[{"이름":"증여자관계","종류":"글"},{"이름":"수증자생년월일","종류":"날짜"},{"이름":"혼인신고일","종류":"날짜"},{"이름":"자녀출생일","종류":"목록"},{"이름":"재산","종류":"목록","속칸":["종류","다음고시일","이름","지분","지금기준시가","다음기준시가","시가"]},{"이름":"기준일","종류":"날짜"},{"이름":"후보일","종류":"목록"},{"이름":"사전증여","종류":"목록","속칸":["날짜","금액","과세표준","낸세액","같은증여자"]},{"이름":"세대생략","종류":"예아니오"},{"이름":"다른직계존속공제씀","종류":"글"},{"이름":"수증자","종류":"글"}],"근거":[],"함수":"judgeGiftTiming_"},{"묶음":"생활비교육비","이름":"생활비교육비","별칭":["생활비교육비","비과세증여","혼인출산공제"],"무리":"상속증여","칸":[{"이름":"거주자","종류":"예아니오"},{"이름":"혼인신고일","종류":"날짜"},{"이름":"자녀출생일","종류":"목록"},{"이름":"피부양","종류":"예아니오"},{"이름":"지출","종류":"목록","속칸":["항목","금액","날짜","직접지출","남은재산","관계"]},{"이름":"축의금","종류":"묶음","속칸":["총액","혼주몫","받은사람","쓴곳"]},{"이름":"혼인예정","종류":"예아니오"},{"이름":"혼인출산공제씀","종류":"글"},{"이름":"직계존속공제씀","종류":"글"},{"이름":"수증자","종류":"글"}],"근거":[],"함수":"judgeFamilySupportGift_"},{"묶음":"세무조사절차","이름":"세무조사절차","별칭":["세무조사절차","세무조사","세무조사 통지"],"무리":"기한","칸":[{"이름":"공휴일","종류":"목록"},{"이름":"통지받은날","종류":"날짜"},{"이름":"실제시작일","종류":"날짜"},{"이름":"조사시작일","종류":"날짜"},{"이름":"재조사결정","종류":"예아니오"},{"이름":"통지생략사유","종류":"예아니오"},{"이름":"연기사유","종류":"글"},{"이름":"연기신청일","종류":"날짜"},{"이름":"수입금액","종류":"숫자"},{"이름":"조사종류","종류":"글"},{"이름":"세목","종류":"글"},{"이름":"탈루유형","종류":"글"},{"이름":"실제종료일","종류":"날짜"},{"이름":"조사종료일","종류":"날짜"},{"이름":"중지","종류":"목록"},{"이름":"연장","종류":"목록","속칸":["일수","승인"]},{"이름":"같은세목기간조사","종류":"예아니오"},{"이름":"재조사사유","종류":"글"},{"이름":"결과통지받은날","종류":"날짜"},{"이름":"수정신고일","종류":"날짜"}],"근거":[],"함수":"judgeTaxAudit_"},{"묶음":"세금대납","이름":"세금대납","별칭":["세금대납","상속세 대납","증여세 대납"],"무리":"상속증여","칸":[{"이름":"종류","종류":"글"},{"이름":"상속세","종류":"글"},{"이름":"증여세","종류":"글"}],"근거":[],"함수":"judgeTaxProxyPay_"},{"묶음":"차명계좌","이름":"차명계좌","별칭":["차명계좌","차명 예금","차명계좌 증여추정"],"무리":"상속증여","칸":[{"이름":"관계","종류":"글"},{"이름":"실소유입증","종류":"예아니오"},{"이름":"출연자사망일","종류":"날짜"},{"이름":"계좌","종류":"목록","속칸":["금액","명의자입증","이름","종류","잔액","입금일","명의자사용","증여추정금액"]},{"이름":"상속세신고","종류":"예아니오"},{"이름":"신고에넣음","종류":"예아니오"},{"이름":"부정행위","종류":"예아니오"},{"이름":"안날","종류":"날짜"},{"이름":"관련자사망","종류":"예아니오"}],"근거":[],"함수":"judgeBorrowedAccount_"},{"묶음":"부동산명의신탁","이름":"부동산명의신탁","별칭":["부동산명의신탁","명의신탁 부동산"],"무리":"상속증여","칸":[{"이름":"자산","종류":"글"},{"이름":"관계","종류":"글"},{"이름":"유형","종류":"글"},{"이름":"자금","종류":"글"},{"이름":"처분권","종류":"글"},{"이름":"대금귀속","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"취득일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득가액","종류":"숫자"},{"이름":"매도인선의","종류":"예아니오"},{"이름":"신탁자","종류":"글"},{"이름":"명의자","종류":"글"},{"이름":"명의자신고","종류":"예아니오"},{"이름":"신탁자사망일","종류":"날짜"},{"이름":"실명전환일","종류":"날짜"}],"근거":[],"함수":"judgeNomineeRealty_"},{"묶음":"제2차납세의무","이름":"제2차납세의무","별칭":["제2차납세의무","제2차 납세의무","과점주주"],"무리":"상속증여","칸":[{"이름":"상장","종류":"예아니오"},{"이름":"발행주식","종류":"목록"},{"이름":"주주","종류":"목록","속칸":["이름","관계","이력","주식수","명의만","실질소유자"]},{"이름":"체납","종류":"목록","속칸":["세목","성립일","원천징수지급일","과세기간끝","예정신고","금액"]},{"이름":"법인재산충당","종류":"글"},{"이름":"기준주주","종류":"글"},{"이름":"통지일","종류":"날짜"},{"이름":"공휴일","종류":"날짜"}],"근거":[],"함수":"judgeSecondaryLiability_"},{"묶음":"특별연고자","이름":"특별연고자","별칭":["특별연고자","특별연고자 분여","재산분여"],"무리":"상속증여","칸":[{"이름":"사망일","종류":"날짜"},{"이름":"관리인선임일","종류":"날짜"},{"이름":"수색공고만료일","종류":"날짜"},{"이름":"분여청구일","종류":"날짜"},{"이름":"분여확정일","종류":"날짜"},{"이름":"분여","종류":"목록"},{"이름":"재산합계","종류":"글"},{"이름":"채무","종류":"숫자"},{"이름":"공과금","종류":"글"},{"이름":"사전증여","종류":"목록","속칸":["증여일","금액","낸증여세","과세표준"]},{"이름":"장례비","종류":"글"},{"이름":"국외주소","종류":"예아니오"}],"근거":[],"함수":"judgeSpecialRelation_"},{"묶음":"기타자산","이름":"기타자산","별칭":["기타자산","영업권","회원권","영업권·회원권"],"무리":"기타","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"복식부기의무자","종류":"예아니오"},{"이름":"품목","종류":"목록","속칸":["이름","종류","양도가액","취득가액","취득일","함께양도부동산","실제경비"]}],"근거":[],"함수":"judgeOtherAsset_"},{"묶음":"한정승인","이름":"한정승인","별칭":["한정승인","상속 한정승인","특별한정승인"],"무리":"상속증여","칸":[{"이름":"사망일","종류":"날짜"},{"이름":"안날","종류":"날짜"},{"이름":"한정승인신고일","종류":"날짜"},{"이름":"채무초과안날","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"중대과실없음","종류":"예아니오"},{"이름":"포기신고일","종류":"날짜"},{"이름":"재산","종류":"목록"},{"이름":"채무","종류":"숫자"},{"이름":"공과금","종류":"글"},{"이름":"사전증여","종류":"목록","속칸":["증여일","상속인","받은사람","금액","과세표준","낸증여세","합산"]},{"이름":"국외주소","종류":"예아니오"},{"이름":"장례비","종류":"글"}],"근거":[],"함수":"judgeLimitedAccept_"},{"묶음":"국외증여","이름":"국외 증여","별칭":["국외증여","국외 증여","국외재산 증여"],"무리":"상속증여","칸":[{"이름":"증여일","종류":"날짜"},{"이름":"증여자거주자","종류":"글"},{"이름":"수증자거주자","종류":"글"},{"이름":"사인증여","종류":"글"},{"이름":"재산소재","종류":"글"},{"이름":"외국증여세","종류":"글"},{"이름":"외국납부세액","종류":"숫자"},{"이름":"외국과세표준","종류":"숫자"},{"이름":"특수관계","종류":"글"},{"이름":"시가근거","종류":"묶음","속칸":["날짜","종류"]},{"이름":"유가증권","종류":"글"}],"근거":[],"함수":"judgeForeignGift_"},{"묶음":"거주자","이름":"거주자","별칭":["거주자","거주자 판정","비거주자"],"무리":"상속증여","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"목적","종류":"글"},{"이름":"국내체류","종류":"목록","속칸":["입국","출국"]},{"이름":"일시출국","종류":"목록","속칸":["출국","입국"]},{"이름":"국내주소","종류":"글"},{"이름":"직업183일","종류":"날짜"},{"이름":"국내가족","종류":"글"},{"이름":"계속거주예상","종류":"글"},{"이름":"외국국적또는영주권","종류":"글"},{"이름":"재입국거주예상","종류":"글"},{"이름":"국내자산","종류":"글"},{"이름":"해외파견","종류":"글"},{"이름":"영주귀국사망","종류":"글"},{"이름":"국외이전출국일","종류":"날짜"},{"이름":"상속인외국주소","종류":"글"}],"근거":[],"함수":"judgeResidency_"},{"묶음":"상속인","이름":"상속인·법정상속분","별칭":["상속인","법정상속분","상속인·법정상속분"],"무리":"상속증여","칸":[{"이름":"실종선고일","종류":"날짜"},{"이름":"실종기간만료일","종류":"날짜"},{"이름":"사망일","종류":"날짜"},{"이름":"배우자","종류":"묶음","속칸":["포기","이름"]},{"이름":"자녀","종류":"목록","속칸":["이름","대습","자녀","결격","사망일"]},{"이름":"국외주소","종류":"예아니오"}],"근거":[],"함수":"judgeHeirShares_"},{"묶음":"불복기한","이름":"불복기한","별칭":["불복기한","불복","경정청구기한"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"조사결과통지받은날","종류":"날짜"},{"이름":"과세예고통지받은날","종류":"날짜"},{"이름":"적부심청구일","종류":"날짜"},{"이름":"제척기간만료일","종류":"날짜"},{"이름":"납부기한전징수","종류":"예아니오"},{"이름":"수시부과","종류":"예아니오"},{"이름":"고발통고","종류":"예아니오"},{"이름":"세액","종류":"숫자"},{"이름":"적부심결정받은날","종류":"날짜"},{"이름":"고지서받은날","종류":"날짜"},{"이름":"심사청구일","종류":"날짜"},{"이름":"심판청구일","종류":"날짜"},{"이름":"처분청","종류":"글"},{"이름":"이의신청일","종류":"날짜"},{"이름":"지방청조사","종류":"예아니오"},{"이름":"이의항변","종류":"예아니오"},{"이름":"이의결정받은날","종류":"날짜"},{"이름":"결정받은날","종류":"날짜"},{"이름":"소송제기일","종류":"날짜"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"신고함","종류":"예아니오"},{"이름":"경정청구일","종류":"날짜"}],"근거":[],"함수":"judgeAppealDeadline_"},{"묶음":"양도여부","이름":"양도로 보지 않음","별칭":["양도여부","양도로 보지 않음"],"무리":"토지","칸":[{"이름":"유형","종류":"글"},{"이름":"지분","종류":"숫자"},{"이름":"받은몫비율","종류":"숫자"},{"이름":"정산금받음","종류":"글"},{"이름":"정산금줌","종류":"글"},{"이름":"전체시가","종류":"글"},{"이름":"날짜","종류":"날짜"},{"이름":"내취득가액","종류":"숫자"},{"이름":"내취득일","종류":"날짜"},{"이름":"분할면적합","종류":"글"},{"이름":"분할전면적합","종류":"글"},{"이름":"경계조정목적","종류":"예아니오"},{"이름":"법에따른분할","종류":"예아니오"},{"이름":"입증자료제출","종류":"예아니오"},{"이름":"받은토지시가","종류":"글"},{"이름":"받은정산금","종류":"글"},{"이름":"준정산금","종류":"글"},{"이름":"담보의사","종류":"예아니오"},{"이름":"사용수익유지","종류":"예아니오"},{"이름":"채무약정","종류":"예아니오"},{"이름":"계약서사본첨부","종류":"예아니오"},{"이름":"변제충당일","종류":"날짜"},{"이름":"실질지배","종류":"예아니오"},{"이름":"신탁해지가능","종류":"예아니오"},{"이름":"수익자변경가능","종류":"예아니오"},{"이름":"환지처분","종류":"예아니오"},{"이름":"보류지충당","종류":"예아니오"},{"이름":"청산금받음","종류":"글"},{"이름":"권리가액","종류":"숫자"},{"이름":"공고일","종류":"날짜"},{"이름":"잔금일","종류":"날짜"},{"이름":"등기접수일","종류":"날짜"},{"이름":"해제일","종류":"날짜"},{"이름":"해제종류","종류":"글"},{"이름":"감액","종류":"숫자"},{"이름":"원래양도가액","종류":"숫자"},{"이름":"공휴일","종류":"목록"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"부득이사유","종류":"예아니오"},{"이름":"신고함","종류":"예아니오"},{"이름":"입장","종류":"글"},{"이름":"받은계약금","종류":"글"},{"이름":"돌려준금액","종류":"숫자"},{"이름":"배액상환","종류":"글"},{"이름":"받은위약금","종류":"글"},{"이름":"판결일","종류":"날짜"},{"이름":"허가구역","종류":"예아니오"},{"이름":"허가받음","종류":"예아니오"},{"이름":"다시판매","종류":"예아니오"}],"근거":[],"함수":"judgeTransferScope_"},{"묶음":"계약해제","이름":"양도로 보지 않음","별칭":["계약해제"],"무리":"토지","칸":[{"이름":"유형","종류":"글"},{"이름":"지분","종류":"숫자"},{"이름":"받은몫비율","종류":"숫자"},{"이름":"정산금받음","종류":"글"},{"이름":"정산금줌","종류":"글"},{"이름":"전체시가","종류":"글"},{"이름":"날짜","종류":"날짜"},{"이름":"내취득가액","종류":"숫자"},{"이름":"내취득일","종류":"날짜"},{"이름":"분할면적합","종류":"글"},{"이름":"분할전면적합","종류":"글"},{"이름":"경계조정목적","종류":"예아니오"},{"이름":"법에따른분할","종류":"예아니오"},{"이름":"입증자료제출","종류":"예아니오"},{"이름":"받은토지시가","종류":"글"},{"이름":"받은정산금","종류":"글"},{"이름":"준정산금","종류":"글"},{"이름":"담보의사","종류":"예아니오"},{"이름":"사용수익유지","종류":"예아니오"},{"이름":"채무약정","종류":"예아니오"},{"이름":"계약서사본첨부","종류":"예아니오"},{"이름":"변제충당일","종류":"날짜"},{"이름":"실질지배","종류":"예아니오"},{"이름":"신탁해지가능","종류":"예아니오"},{"이름":"수익자변경가능","종류":"예아니오"},{"이름":"환지처분","종류":"예아니오"},{"이름":"보류지충당","종류":"예아니오"},{"이름":"청산금받음","종류":"글"},{"이름":"권리가액","종류":"숫자"},{"이름":"공고일","종류":"날짜"},{"이름":"잔금일","종류":"날짜"},{"이름":"등기접수일","종류":"날짜"},{"이름":"해제일","종류":"날짜"},{"이름":"해제종류","종류":"글"},{"이름":"감액","종류":"숫자"},{"이름":"원래양도가액","종류":"숫자"},{"이름":"공휴일","종류":"목록"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"부득이사유","종류":"예아니오"},{"이름":"신고함","종류":"예아니오"},{"이름":"입장","종류":"글"},{"이름":"받은계약금","종류":"글"},{"이름":"돌려준금액","종류":"숫자"},{"이름":"배액상환","종류":"글"},{"이름":"받은위약금","종류":"글"},{"이름":"판결일","종류":"날짜"},{"이름":"허가구역","종류":"예아니오"},{"이름":"허가받음","종류":"예아니오"},{"이름":"다시판매","종류":"예아니오"}],"근거":[],"함수":"judgeTransferScope_"},{"묶음":"8년자경","이름":"8년 자경농지 감면","별칭":["8년자경","자경","8년 자경농지 감면"],"무리":"토지","칸":[{"이름":"양도일","종류":"날짜"},{"이름":"경영이양3년","종류":"숫자"},{"이름":"거주지역","종류":"글"},{"이름":"직접경작","종류":"예아니오"},{"이름":"경작","종류":"목록","속칸":["누가","시작","끝"]},{"이름":"소득초과해","종류":"묶음"},{"이름":"상속받은날","종류":"날짜"},{"이름":"상속후경작개월","종류":"숫자"},{"이름":"양도일거주자","종류":"예아니오"},{"이름":"양도일농지","종류":"예아니오"},{"이름":"도시편입일","종류":"날짜"},{"이름":"편입시지역","종류":"예아니오"},{"이름":"환지예정지지정일","종류":"날짜"}],"근거":[],"함수":"judgeSelfFarm_"},{"묶음":"동거주택","이름":"동거주택 상속공제","별칭":["동거주택","동거주택 상속공제"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"상속인관계","종류":"글"},{"이름":"동거시작일","종류":"날짜"},{"이름":"상속인생년월일","종류":"날짜"},{"이름":"동거못한기간","종류":"목록","속칸":["시작","끝","사유"]},{"이름":"일세대일주택10년","종류":"예아니오"},{"이름":"무주택또는공동","종류":"예아니오"},{"이름":"주택가액","종류":"숫자"},{"이름":"담보채무","종류":"숫자"},{"이름":"상속지분","종류":"숫자"}],"근거":[],"함수":"judgeCohabit_"},{"묶음":"가업상속","이름":"가업상속공제","별칭":["가업상속","가업상속공제"],"무리":"상속증여","칸":[{"이름":"상속개시일","종류":"날짜"},{"이름":"기업규모","종류":"글"},{"이름":"특례증여","종류":"묶음","속칸":["증여일","가업자산상당액","전부증여","매출평균3년","증여전지분율","처분지분감소","종사또는대표"]},{"이름":"매출평균3년","종류":"숫자"},{"이름":"업종해당","종류":"예아니오"},{"이름":"경영시작일","종류":"날짜"},{"이름":"지분율","종류":"숫자"},{"이름":"상장","종류":"예아니오"},{"이름":"지분10년보유","종류":"예아니오"},{"이름":"대표재직","종류":"묶음","속칸":["절반이상","십년승계","최근10년중5년"]},{"이름":"상속인생년월일","종류":"날짜"},{"이름":"피상속인65세전사망","종류":"예아니오"},{"이름":"상속인종사년수","종류":"숫자"},{"이름":"임원취임","종류":"글"},{"이름":"가업상속재산가액","종류":"숫자"}],"근거":[],"함수":"judgeFamilyBiz_"},{"묶음":"청산인제2차납세의무","이름":"청산인제2차납세의무","별칭":["청산인제2차납세의무","청산인","잔여재산분배","§38①"],"무리":"상속증여","칸":[{"이름":"세금","종류":"목록"},{"이름":"받은사람들","종류":"목록"},{"이름":"해산일","종류":"날짜"},{"이름":"분배일","종류":"날짜"},{"이름":"잔여재산가액확정일","종류":"날짜"},{"이름":"법인충당후부족액","종류":"숫자"},{"이름":"청산인","종류":"글"}],"근거":[],"함수":"judgeLiquidatorSecondary_"},{"묶음":"무상주","이름":"무상주","별칭":["무상주","자본전입","무상증자","의제배당무상주","§17②2호"],"무리":"기타","칸":[{"이름":"전입들","종류":"목록"},{"이름":"재원","종류":"글"},{"이름":"전입액","종류":"숫자"},{"이름":"토지재평가차액","종류":"숫자"},{"이름":"자산재평가차액","종류":"숫자"},{"이름":"신규주식수","종류":"숫자"},{"이름":"보유주식","종류":"글"},{"이름":"발행주식","종류":"글"},{"이름":"회사자기주식","종류":"글"},{"이름":"무액면","종류":"예아니오"},{"이름":"액면가","종류":"글"},{"이름":"받은신주","종류":"글"},{"이름":"구주취득가액","종류":"숫자"},{"이름":"소액주주","종류":"예아니오"},{"이름":"전입일","종류":"날짜"},{"이름":"소각일","종류":"날짜"},{"이름":"소각주식수","종류":"숫자"},{"이름":"소각대가","종류":"글"}],"근거":[],"함수":"judgeBonusShare_"},{"묶음":"대물변제","이름":"대물변제","별칭":["대물변제","위자료","채무변제양도","양도담보충당"],"무리":"기타","칸":[{"이름":"넘김","종류":"글"},{"이름":"자산","종류":"글"},{"이름":"채무원금","종류":"글"},{"이름":"이자","종류":"글"},{"이름":"시가","종류":"글"},{"이름":"취득가액","종류":"숫자"},{"이름":"비용","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"특수관계","종류":"예아니오"},{"이름":"담보의사표시","종류":"예아니오"},{"이름":"채무자사용수익","종류":"예아니오"},{"이름":"원리금약정","종류":"예아니오"},{"이름":"계약서첨부","종류":"예아니오"},{"이름":"변제충당","종류":"예아니오"},{"이름":"1세대1주택","종류":"글"},{"이름":"취득일","종류":"날짜"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeDebtSettle_"},{"묶음":"시효취득","이름":"시효취득","별칭":["시효취득","점유취득시효","취득시효","시효취득양도","민법 §245"],"무리":"기타","칸":[{"이름":"점유개시일","종류":"날짜"},{"이름":"등기접수일","종류":"날짜"},{"이름":"판결확정일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"취득기준시가","종류":"글"},{"이름":"양도기준시가","종류":"글"},{"이름":"등기일기준시가","종류":"글"},{"이름":"매매사례가액","종류":"숫자"},{"이름":"감정가액","종류":"숫자"},{"이름":"소송비용","종류":"글"},{"이름":"자본적지출","종류":"글"},{"이름":"양도비","종류":"글"},{"이름":"자산","종류":"글"},{"이름":"농지","종류":"예아니오"},{"이름":"재촌자경","종류":"예아니오"},{"이름":"전소유자특수관계","종류":"예아니오"},{"이름":"비사업용","종류":"예아니오"},{"이름":"엔진칸","종류":"묶음"},{"이름":"등기일시가","종류":"글"},{"이름":"관계","종류":"글"}],"근거":[],"함수":"judgeAdversePossession_"},{"묶음":"가족차용","이름":"가족차용","별칭":["가족차용","차용증","금전무상대출","저리대출","§41의4","담보제공이익"],"무리":"기타","칸":[{"이름":"대출일","종류":"날짜"},{"이름":"원금","종류":"글"},{"이름":"약정이자율","종류":"숫자"},{"이름":"대출기간개월","종류":"숫자"},{"이름":"적정이자율","종류":"숫자"},{"이름":"실제지급이자","종류":"글"},{"이름":"특수관계","종류":"예아니오"},{"이름":"대여자법인","종류":"예아니오"},{"이름":"차용증","종류":"예아니오"},{"이름":"이자지급흔적","종류":"예아니오"},{"이름":"원금상환들","종류":"목록","속칸":["날짜","금액"]},{"이름":"변제기","종류":"날짜"},{"이름":"정당한사유","종류":"예아니오"},{"이름":"직전1년이익들","종류":"목록"},{"이름":"담보","종류":"묶음","속칸":["차입금","차입기간개월","실제이자","제공자특수관계"]},{"이름":"상환자금입증액","종류":"숫자"},{"이름":"관계","종류":"글"}],"근거":[],"함수":"judgeFamilyLoan_"},{"묶음":"국외재산평가","이름":"국외재산평가","별칭":["국외재산평가","국외재산","외국부동산평가","외화평가","환율평가","§58의3","§58의4"],"무리":"상속증여","칸":[{"이름":"종류","종류":"글"},{"이름":"평가기준일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"증여일","종류":"날짜"},{"이름":"수증자거주자","종류":"예아니오"},{"이름":"피상속인거주자","종류":"예아니오"},{"이름":"재산들","종류":"목록","속칸":["외화금액","기준환율","다른날환율","근거","근거날짜","감정기관수","통화","특수관계거래","종류"]},{"이름":"채무들","종류":"목록","속칸":["외화금액","기준환율","통화","이름","담보재산"]},{"이름":"피상속인외국주소","종류":"예아니오"},{"이름":"상속인외국주소","종류":"예아니오"},{"이름":"국내재산합계","종류":"글"},{"이름":"국내채무합계","종류":"글"},{"이름":"엔진칸","종류":"묶음"},{"이름":"관계","종류":"글"}],"근거":[],"함수":"judgeForeignAssetValuation_"},{"묶음":"서화골동품","이름":"서화골동품","별칭":["서화골동품","서화","골동품","미술품","미술품물납"],"무리":"기타","칸":[{"이름":"상황","종류":"글"},{"이름":"물건들","종류":"목록","속칸":["이름","감정들","심의회가액","특수관계거래","판매용","처분예상가액","장부가액"]},{"이름":"상속","종류":"묶음","속칸":["물납희망","납부세액","금융재산가액","문화유산지정"]},{"이름":"양도","종류":"묶음","속칸":["양도가액","보유기간년","생존국내원작자","양수자","사업장","실제경비","취득가액","상속받음"]}],"근거":[],"함수":"judgeArtAntique_"},{"묶음":"무체재산권","이름":"무체재산권","별칭":["무체재산권","특허권","상표권","저작권","산업재산권","§59⑤"],"무리":"기타","칸":[{"이름":"상황","종류":"글"},{"이름":"평가기준일","종류":"날짜"},{"이름":"권리들","종류":"목록","속칸":["이름","종류","취득가액","감가상각누계","잔여존속연수","존속만료일","연도별수입","최근3년수입"]},{"이름":"특수관계","종류":"예아니오"},{"이름":"양도","종류":"묶음","속칸":["양도가액","사용료","종류","양도자","사업용부동산과함께","실제경비","취득가액","특수관계","시가","직무발명"]}],"근거":[],"함수":"judgeIntangibleRight_"},{"묶음":"증액경정","이름":"증액경정","별칭":["증액경정","감액경정","경정의효력","경정 효력","특례제척기간","재처분","§22의3","§26의2⑥"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"법정신고기한","종류":"날짜"},{"이름":"당초신고세액","종류":"숫자"},{"이름":"경정들","종류":"목록","속칸":["이름","종류","통지받은날","경정후세액","증가세액","감소세액"]},{"이름":"판결","종류":"묶음","속칸":["확정일","명의대여확인","실질귀속자","결과"]},{"이름":"다투려는것","종류":"글"}],"근거":[],"함수":"judgeCorrectionEffect_"},{"묶음":"연부연납","이름":"연부연납","별칭":["연부연납","연부연납허가","연부연납담보","연부연납취소","국세징수법 §18"],"무리":"기타","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"세목","종류":"글"},{"이름":"납부세액","종류":"숫자"},{"이름":"가업몫세액","종류":"숫자"},{"이름":"신청기간년","종류":"숫자"},{"이름":"가업몫기간년","종류":"숫자"},{"이름":"담보들","종류":"목록"},{"이름":"신청경로","종류":"글"},{"이름":"신고기한","종류":"날짜"},{"이름":"고지납부기한","종류":"날짜"},{"이름":"신청일","종류":"날짜"},{"이름":"허가통지일","종류":"날짜"},{"이름":"사유들","종류":"목록"},{"이름":"납부들","종류":"목록"},{"이름":"이자율","종류":"숫자"}],"근거":[],"함수":"judgeInstallmentPermit_"},{"묶음":"강제징수","이름":"강제징수","별칭":["강제징수","체납처분","압류금지","급여압류","공매절차","압류해제","국세징수법 §41"],"무리":"기타","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"체납들","종류":"목록"},{"이름":"압류들","종류":"목록","속칸":["이름","종류","가액","월급여세후","퇴직금총액","예금잔액"]},{"이름":"납부","종류":"묶음","속칸":["전부납부","부과취소","일부납부액"]},{"이름":"공매","종류":"묶음","속칸":["공고일","추산가격","공고기간일","매각일","체납자통지","유찰횟수"]},{"이름":"유예","종류":"묶음","속칸":["사유","납부계획서"]},{"이름":"사망","종류":"묶음","속칸":["사망일"]},{"이름":"사해행위","종류":"묶음","속칸":["처분일","상대","종류"]}],"근거":[],"함수":"judgeEnforcementCollection_"},{"묶음":"주식매수청구","이름":"주식매수청구","별칭":["주식매수청구","주식매수청구권","반대주주","매수청구양도","§94①3호"],"무리":"기타","칸":[{"이름":"회사","종류":"묶음","속칸":["상장","중소기업"]},{"이름":"주주","종류":"묶음"},{"이름":"매수","종류":"묶음"},{"이름":"사유","종류":"글"},{"이름":"상법조문","종류":"글"},{"이름":"회사처분","종류":"글"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeAppraisalRightSale_"},{"묶음":"주식매수선택권","이름":"주식매수선택권","별칭":["주식매수선택권","스톡옵션","벤처스톡옵션","선택권행사이익","§16의2","§16의4"],"무리":"기타","칸":[{"이름":"회사","종류":"묶음","속칸":["벤처","코넥스","중소기업"]},{"이름":"양도","종류":"묶음"},{"이름":"주식수","종류":"숫자"},{"이름":"행사가액","종류":"숫자"},{"이름":"행사당시시가","종류":"글"},{"이름":"부여당시시가","종류":"글"},{"이름":"행사일","종류":"날짜"},{"이름":"부여일","종류":"날짜"},{"이름":"신분","종류":"글"},{"이름":"특례","종류":"글"},{"이름":"부여근거","종류":"글"},{"이름":"올해이미비과세","종류":"글"},{"이름":"법인별누적비과세","종류":"글"},{"이름":"현금정산","종류":"예아니오"},{"이름":"제외사유","종류":"글"},{"이름":"전체행사가액2년","종류":"숫자"},{"이름":"전용계좌","종류":"예아니오"},{"이름":"신청일","종류":"날짜"},{"이름":"한계세율","종류":"숫자"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgeStockOption_"},{"묶음":"우리사주","이름":"우리사주","별칭":["우리사주","우리사주조합","우리사주인출","자사주배정","§88의4"],"무리":"기타","칸":[{"이름":"중소기업","종류":"예아니오"},{"이름":"벤처등","종류":"예아니오"},{"이름":"출자들","종류":"목록","속칸":["출자금액","소득공제받음"]},{"이름":"전년총급여","종류":"글"},{"이름":"배정들","종류":"목록","속칸":["이름","주수","매입가액등","취득시가","출처","공제안받은출자분"]},{"이름":"인출","종류":"묶음","속칸":["인출일","주수","인출일시가","파산"]},{"이름":"양도","종류":"묶음","속칸":["양도가액","상장","장내","대주주","양도일"]},{"이름":"배당","종류":"묶음","속칸":["금액","소액주주","액면합계","예탁일"]}],"근거":[],"함수":"judgeEsop_"},{"묶음":"공동사업출자","이름":"공동사업출자","별칭":["공동사업출자","동업출자","조합출자","공동사업탈퇴"],"무리":"감면","칸":[{"이름":"출자","종류":"묶음","속칸":["출자가액","시가","취득가액","본인지분율","다른조합원특수관계","등기접수일","출자일","출자공동사업자","자산","취득일"]},{"이름":"조합","종류":"묶음"},{"이름":"탈퇴","종류":"묶음"},{"이름":"엔진칸","종류":"묶음"}],"근거":[],"함수":"judgePartnershipContribution_"},{"묶음":"송달","이름":"송달","별칭":["송달","송달적법","공시송달","전자송달","고지서송달","국세기본법 §8"],"무리":"기타","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"서류","종류":"글"},{"이름":"방법","종류":"글"},{"이름":"명의인","종류":"글"},{"이름":"납세관리인있음","종류":"예아니오"},{"이름":"상속재산관리인있음","종류":"예아니오"},{"이름":"연대납세의무자들","종류":"목록"},{"이름":"송달장소","종류":"글"},{"이름":"신고장소있음","종류":"예아니오"},{"이름":"주소이전","종류":"예아니오"},{"이름":"이전확인","종류":"예아니오"},{"이름":"고지금액","종류":"숫자"},{"이름":"수령일","종류":"날짜"},{"이름":"수령자","종류":"글"},{"이름":"수령자사리분별","종류":"예아니오"},{"이름":"거부정당사유","종류":"예아니오"},{"이름":"유치","종류":"예아니오"},{"이름":"전자","종류":"묶음","속칸":["신청","저장일","열람일","연속미열람","장애"]},{"이름":"공시","종류":"묶음","속칸":["사유","주민등록확인","등기반송","방문횟수","방문첫날","방문끝날","공고방법들","공고일"]},{"이름":"제척기간만료일","종류":"날짜"},{"이름":"납부기한","종류":"날짜"}],"근거":[],"함수":"judgeServiceValidity_"},{"묶음":"신고기한특례","이름":"신고기한특례","별칭":["신고기한특례","우편신고","전자신고","기한특례","§5의2","국세기본법 §6"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"공휴일","종류":"목록"},{"이름":"종류","종류":"글"},{"이름":"방법","종류":"글"},{"이름":"법정기한","종류":"날짜"},{"이름":"우편","종류":"묶음","속칸":["도착일","소인일","발송일","소인불명"]},{"이름":"납부","종류":"묶음"},{"이름":"전자","종류":"묶음","속칸":["전송일시","장애","복구일","접수증"]},{"이름":"방문","종류":"묶음"},{"이름":"연장","종류":"묶음","속칸":["사유","신청일","승인","연장기한","재연장횟수"]}],"근거":[],"함수":"judgeFilingTimeliness_"},{"묶음":"납세의무성립","이름":"납세의무성립","별칭":["납세의무성립","성립시기","납세의무확정","적용법령","소급과세","§22의2"],"무리":"기한","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"세목","종류":"글"},{"이름":"양도일","종류":"날짜"},{"이름":"상속개시일","종류":"날짜"},{"이름":"증여일","종류":"날짜"},{"이름":"과세기간","종류":"숫자"},{"이름":"지급일","종류":"날짜"},{"이름":"신고일","종류":"날짜"},{"이름":"신고기한","종류":"날짜"},{"이름":"결정통지일","종류":"날짜"},{"이름":"경정통지일","종류":"날짜"},{"이름":"수정신고일","종류":"날짜"},{"이름":"개정","종류":"묶음","속칸":["시행일","적용례","내용"]},{"이름":"해석변경","종류":"묶음","속칸":["날짜","종전관행"]}],"근거":[],"함수":"judgeTaxLiabilityTiming_"},{"묶음":"신뢰보호","이름":"신뢰보호","별칭":["신뢰보호","신의성실","질의회신","사전답변","공적견해","비과세관행","§18③"],"무리":"기타","칸":[{"이름":"믿은것","종류":"글"},{"이름":"회신","종류":"묶음"},{"이름":"관행","종류":"묶음"},{"이름":"행위","종류":"묶음"},{"이름":"처분","종류":"묶음"},{"이름":"해석변경일","종류":"날짜"}],"근거":[],"함수":"judgeGoodFaithReliance_"},{"묶음":"납세지","이름":"납세지","별칭":["납세지","과세관할","관할세무서","신고관할","상증법 §6","§43②"],"무리":"기타","칸":[{"이름":"세목","종류":"글"},{"이름":"피상속인","종류":"묶음"},{"이름":"수증자","종류":"묶음"},{"이름":"증여자","종류":"묶음"},{"이름":"양도자","종류":"묶음"},{"이름":"재산들","종류":"목록","속칸":["이름","종류","소재지","가액"]},{"이름":"상속인·납세관리인 신고납세지","종류":"글"},{"이름":"낸세무서","종류":"글"}],"근거":[],"함수":"judgeTaxJurisdiction_"},{"묶음":"고액상속사후조사","이름":"고액상속사후조사","별칭":["고액상속사후조사","상속사후조사","상속인재산증가","30억상속","§76⑤"],"무리":"상속증여","칸":[{"이름":"기준일","종류":"날짜"},{"이름":"결정상속재산가액","종류":"숫자"},{"이름":"상속개시일","종류":"날짜"},{"이름":"정상증가율","종류":"숫자"},{"이름":"상속인들","종류":"목록","속칸":["이름","당시주요재산","지금주요재산","받은상속재산","신고소득","신고수증재산","처분대가","부채부담","증가요인명백"]}],"근거":[],"함수":"judgeEstateFollowUpAudit_"},{"묶음":"가업상속자산양도","이름":"가업상속자산양도","별칭":["가업상속자산양도","가업상속자산","가업자산양도","§97의2④","§18의2⑩"],"무리":"상속증여","칸":[{"이름":"가업형태","종류":"글"},{"이름":"상속개시일","종류":"날짜"},{"이름":"양도일","종류":"날짜"},{"이름":"기준일","종류":"날짜"},{"이름":"양도가액","종류":"숫자"},{"이름":"상속개시당시가액","종류":"숫자"},{"이름":"피상속인취득가액","종류":"숫자"},{"이름":"피상속인취득일","종류":"날짜"},{"이름":"가업상속공제금액","종류":"숫자"},{"이름":"가업상속재산가액","종류":"숫자"},{"이름":"적용률","종류":"숫자"},{"이름":"자산종류","종류":"글"},{"이름":"엔진추가입력","종류":"묶음"},{"이름":"처분비율","종류":"숫자"},{"이름":"정당한사유","종류":"예아니오"},{"이름":"당초상속세입력","종류":"묶음"}],"근거":[],"함수":"judgeBizAssetSale_"},{"묶음":"국외전출","이름":"국외전출","별칭":["국외전출","국외전출세","국외전출자","§118의9","§118의16"],"무리":"상속증여","칸":[{"이름":"공휴일","종류":"목록"},{"이름":"출국일","종류":"날짜"},{"이름":"기준일","종류":"날짜"},{"이름":"국내거주","종류":"목록"},{"이름":"대주주","종류":"예아니오"},{"이름":"유학","종류":"예아니오"},{"이름":"실제양도가액","종류":"숫자"},{"이름":"실제양도일","종류":"날짜"},{"이름":"보유현황미신고","종류":"예아니오"},{"이름":"엔진입력","종류":"묶음"},{"이름":"납세관리인신고","종류":"예아니오"},{"이름":"납세담보","종류":"예아니오"},{"이름":"납부유예","종류":"예아니오"},{"이름":"납부일","종류":"날짜"}],"근거":[],"함수":"judgeExitTax_"},{"묶음":"초과배당","이름":"초과배당","별칭":["초과배당","불균등배당","배당포기","§41의2"],"무리":"기타","칸":[{"이름":"공휴일","종류":"목록"},{"이름":"지급일","종류":"날짜"},{"이름":"총배당","종류":"숫자"},{"이름":"주주","종류":"목록"},{"이름":"결의일","종류":"날짜"},{"이름":"엔진입력","종류":"묶음"}],"근거":[],"함수":"judgeExcessDividend_"},{"묶음":"장애인신탁","이름":"장애인신탁","별칭":["장애인신탁","장애인 신탁","자익신탁","타익신탁","§52의2"],"무리":"기타","칸":[{"이름":"공휴일","종류":"목록"},{"이름":"종류","종류":"글"},{"이름":"증여일","종류":"날짜"},{"이름":"재산가액","종류":"숫자"},{"이름":"앞선누적","종류":"숫자"},{"이름":"장애인해당","종류":"예아니오"},{"이름":"재산종류","종류":"글"},{"이름":"신탁업자","종류":"예아니오"},{"이름":"이익전부수익자","종류":"예아니오"},{"이름":"사망시까지","종류":"예아니오"},{"이름":"타익계약","종류":"묶음","속칸":["잔여재산귀속","수익자변경금지","위탁자지위이전"]},{"이름":"신청일","종류":"날짜"},{"이름":"사후관리","종류":"묶음","속칸":["사유","사유일","부득이","재가입일","귀속이익","이익전액","용도","월인출액","개월","감소액","인출신청서제출일","_use"]},{"이름":"중증","종류":"예아니오"}],"근거":[],"함수":"judgeDisabledTrust_"},{"묶음":"비사업용 토지","이름":"비사업용 토지 판정","별칭":["비사업용","비사업용 토지"],"무리":"토지","칸":[],"근거":["소득세법 §104의3","시행령 §168의6~§168의14"],"따로창":"nonBizLand"},{"묶음":"대주주","이름":"대주주 판정","별칭":["대주주","주식 대주주"],"무리":"기타","칸":[],"근거":["소득세법 시행령 §157④⑤"],"따로창":"majorShareholder"}];
var JUDGE_SEAM_NAMES_ = ["넥스 → 매매계약 해제 판정(양도시기 뒤 해제·몰취 계약금 기타소득·경정청구 기한)","넥스 → 상속인 판정(동시사망 배우자 빼기·태아 미성년자공제·실종선고 상속개시일)","넥스 → 한정승인 판정(기한·채무 초과분 0·사전증여 가산·경매 양도소득세)","넥스 → 문화유산 상속세 징수유예 판정(상증법 §74)","넥스 → 상속세 외국납부세액공제 판정(상증법 §29·시행령 §21)","넥스 → 주식 취득분 맞추기 판정(소득세법 시행령 §162⑤ 먼저 산 것 먼저)","넥스 → 증여일 판정(상증법 §32·시행령 §24 증여재산 취득시기)","넥스 → 가업승계 주식 증여 특례 판정(조특법 §30의6·조특령 §27의6)","넥스 → 상속추정재산 판정(상증법 §15·시행령 §11)","넥스 → 보험금과세 판정(상증법 §8·§34·시행령 §4①)","넥스 → 대여금채권 판정(상증령 §58②·규칙 §18의2②)","넥스 → 사망퇴직금 판정(상증법 §10)","넥스 → 교차증여 판정(국세기본법 §14③)","넥스 → 자기주식 판정(소득세법 §17②1호·§94①3호)","넥스 → 합병 의제배당 판정(소득세법 §17②4호·시행령 §27①1호)","넥스 → 공동명의 전환 판정(상증법 §53·소득세법 §97의2①·시행령 §156①)","넥스 → 임대·담보 재산 평가 판정(상증법 §60·§61⑤·§66·시행령 §63)","넥스 → 상속 인적공제·일괄공제 판정(상증법 §20·§21·시행령 §18)","넥스 → 미분양주택 특례 판정(조특법 §98의2~§98의9)","넥스 → 양도담보권자 물적납세의무 판정(국세기본법 §42)","넥스 → 연대납세의무 판정(국세기본법 §25·소득세법 §2의2)","넥스 → 국세 우선 배당 순위 판정(국세기본법 §35)","넥스 → 법인의 제2차 납세의무 판정(국세기본법 §40)","넥스 → 사업양수인 제2차 납세의무 판정(국세기본법 §41)","넥스 → 청산인·잔여재산 받은 사람 제2차 납세의무 판정(국세기본법 §38)","넥스 → 무상주 의제배당 판정(소득세법 §17②2호·5호, 시행령 §27)","넥스 → 장애인 신탁 불산입·사후관리 판정(상증법 §52의2·시행령 §45의2)","넥스 → 초과배당 증여 판정(상증법 §41의2·시행령 §31의2)","넥스 → 국외전출세 요건·기한·납부유예 잇기(소득세법 §118의9·§118의15·§118의16·§118의17)","넥스 → 가업상속공제 자산 양도 잇기(소득세법 §97의2④·상증법 §18의2⑤⑩)","넥스 → 고액 상속 5년 사후 재산 증가 조사 판정(상증법 §76⑤·시행령 §78)","넥스 → 납세지·과세 관할 판정(상증법 §6·소득세법 §6·§8·국세기본법 §43)","넥스 → 신의성실·신뢰보호 판정(국세기본법 §15·§18③·시행령 §28①1호)","넥스 → 납세의무 성립·확정·적용 법령 판정(국세기본법 §21·§22·§22의2·§18②)","넥스 → 신고기한 특례·우편 소인·전자 전송·기한 연장 판정(국세기본법 §5·§5의2·§6)","넥스 → 고지서 송달 적법성 판정(국세기본법 §8~§12)","넥스 → 공동사업 현물출자·탈퇴 양도 판정(소득세법 §88 1호·§96·§43)","넥스 → 전환사채 이익 증여 판정(상증법 §40·시행령 §30)","넥스 → 우리사주 인출·양도 판정(조특법 §88의4·시행령 §82의4)","넥스 → 주식매수선택권 행사·양도 판정(조특법 §16의2~§16의4·소득세법 시행령 §163⑬)","넥스 → 주식매수청구권 행사 양도 판정(소득세법 §94①3호 가목 2)·§104①11호)","넥스 → 강제징수 절차·압류금지 판정(국세징수법 §41·§42·§57·§66)","넥스 → 연부연납 허가·담보 판정(상증법 §71·국세징수법 §18)","넥스 → 증액·감액경정 효력·기한 판정(국세기본법 §22의3·§45의2·§26의2⑥)","넥스 → 무체재산권 평가·기타소득 판정(상증법 §64·시행규칙 §19·소득세법 §21①7호)","넥스 → 서화·골동품 평가·기타소득 판정(상증법 §62②·소득세법 §21②)","넥스 → 국외 재산 평가·환율 판정(상증법 시행령 §58의3·§58의4)","넥스 → 가족 간 금전 대여 판정(상증법 §41의4·§37②·§45②)","넥스 → 시효취득 부동산 양도 판정(민법 §245①·소득세법 시행령 §162①6호·§176의2)","넥스 → 대물변제 양도 판정(소득세법 §88 1호·§96·시행령 §151·§167)","넥스 → 국세 징수권 소멸시효 판정(국세기본법 §27·§28)","넥스 → 금융재산 상속공제 범위 판정(상증법 §22②)","넥스 → 추계 취득가액 순서·요건 판정(시행령 §176의2③)","넥스 → 후발적 경정청구 사유·기한 판정(국세기본법 §45의2②)","넥스 → 납부기한등 연장·납부고지 유예 판정(국세징수법 §13·§14)","넥스 → 공익신탁재산 과세가액 불산입 판정(상증법 §17·§52)","넥스 → 공익법인 출연재산 사후관리 즉시 증여세 판정(상증법 §48②③)","넥스 → 유언대용신탁 상속 판정(상증법 §9①·§2 5호)","넥스 → 농업법인 현물출자 이월과세·감면 판정(조특법 §66·§68)","넥스 → 중소기업 간 통합 이월과세 판정(조특법 §31·시행령 §28)","넥스 → 공장 이전 양도소득세 분할납부 판정(조특법 §85의7·§85의8)","넥스 → 농지 교환·분합 비과세 판정(소득세법 §89①2호·시행령 §153)","넥스 → 비상장주식 평가 방법 판정(상증령 §54·§56②·§53)","넥스 → 주식의 포괄적 교환 과세이연 판정(조특법 §38·조특령 §35의2)","넥스 → 자경산지 감면 판정(조특법 §69의4·조특령 §66의4③)","넥스 → 법인 아닌 단체(종중) 양도 가르기(소득세법 §2③·국세기본법 §13)","넥스 → 단기재상속 가르기(상증법 §30·시행령 §9①)","넥스 → 신탁 수익권 양도 가르기(소득세법 §94①6호·시행령 §159의3)","넥스 → 배우자·직계존비속 양도 증여추정 가르기(상증법 §44)","넥스 → 장기일반민간임대주택 양도소득세 감면 요건 가르기(조특법 §97의5)","넥스 → 2013 신축주택 등 감면 요건 가르기(조특법 §99의2)","넥스 → 축사용지 감면 요건 가르기(조특법 §69의2)","넥스 → 재해손실공제 재산별 가르기(상증법 §23·§54)","넥스 → 경영회생 농지 환매 환급 요건 가르기(조특법 §70의2)","넥스 → 재건축 사업기간 대체주택 요건 가르기(소득세법 시행령 §156의2⑤)","넥스 → 농어촌주택·고향주택 특례 요건 가르기(조특법 §99의4)","넥스 → 경매·공매 양도와 낙찰 취득가액 가르기(집행기준 88-0-2·97-163-15~19)","넥스 → 부동산을 취득할 수 있는 권리 가르기(소득세법 §94①2호가·§88 9·10호)","넥스 → 상속인 납세의무 승계(국세기본법 §24·시행령 §11)","넥스 → 가업상속 상속세 납부유예(상증법 §72의2·시행령 §69의3)","넥스 → 국세환급가산금(국세기본법 §52·시행령 §43의3)","넥스 → 부정행위 가르기·신고 가산세(국세기본법 §47의3·조세범 처벌법 §3⑥)","넥스 → 부과제척기간 판정(국세기본법 §26의2·시행령 §12의3)","넥스 → 장기일반민간임대 장특 70% 요건 판정(조특법 §97의3)","넥스 → 개발제한구역 매수·해제 뒤 수용 감면 판정(조특법 §77의3·시행령 §74)","넥스 → 법인·개인 부동산 거래 판정(소득세법 §96③·소득령 §163⑩2호)","넥스 → 비거주자 부동산 양도 판정(소득세법 §121②·§156①5호)","넥스 → 부담부증여 채무 인정·양도분 판정(상증법 §47③·소득령 §159)","넥스 → 신축·증축 감정·환산 가산세 판정(소득세법 §114의2)","넥스 → 미등기양도자산 판정(소득세법 §104③·시행령 §168①)","넥스 → 정비사업 현금청산의 감면 호·양도가액(조특법 §77①2호)","넥스 → 의제취득일 전 취득 자산의 취득가액(소득세법 시행령 §176의2④)","넥스 → 1세대 범위 판정(소득세법 §88 6호·시행령 §152의3)","넥스 → 다주택 중과 판정(소득세법 §104⑦·시행령 §167의3)","넥스 → 필요경비 인정 판정(소득세법 §97·시행령 §163)","넥스 → 주택 해당 여부 판정(소득세법 §88 7호·시행령 §152의4)","넥스 → 주택부수토지 배율 판정(시행령 §154⑦·§168의12)","넥스 → 양도·취득 시기 판정(시행령 §162 각 호)","넥스 → 수용 보상금 가르기(양도·사업·기타·과세 안 함)","넥스 → 대토보상 판정(과세이연금액·추징 기한)","넥스 → 부동산매매업 판정(사업성·비교과세)","넥스 → 공동상속주택 소수지분 판정(최대지분·거주·최연장)","넥스 → 다가구주택 한 채 판정(층수·면적·세대수)","넥스 → 상속 채무 공제(증빙·보증·증여채무)","넥스 → 토지·건물 가액 구분(§100③ 30%)","넥스 → 상속 평가 고르기(기준시가·감정·양도 취득가액)","넥스 → 증여 날짜 고르기(기준시가 고시·10년 합산)","넥스 → 생활비·교육비·결혼자금 비과세 판정","넥스 → 세무조사 절차 판정(사전통지·조사기간·중복조사)","넥스 → 세금대납 판정(연대납부 한도·대납 증여)","넥스 → 차명계좌 판정(증여추정·배제기준·제척기간)","넥스 → 부동산 명의신탁 판정(명의신탁·취득 때 증여·양도 납세의무자)","넥스 → 과점주주 제2차 납세의무 판정(성립일 지분·사람별 한도)","넥스 → 특별연고자 분여 판정(청구 기한·신고기한·공제 경우 셋)","넥스 → 기타자산 판정(영업권·회원권 엔진칸 misc_other·점포 임차권 기타소득·설비 사업소득)"];
// 이음매 점검: 판정만 쓰는 줄은 판정 서버에 한 번 물어 줄마다 그 답을 돌려준다(줄마다 따로 부르면 수 분 걸림)
function jmSeamFilter_(list) {
  var memo = null;
  var get = function () { if (!memo) { try { memo = { r: jmRemote_({ seams: true }) || [] }; } catch (e) { memo = { err: e.message }; } } return memo; };
  var ver = { 길: 'job 서버 → 판정 서버(닿는지·같은 판인지)', fn: function () { var v; try { v = jmRemote_({ ver: true }); } catch (e) { return e.message; } return v === "13f584272b93" ? '' : '판정 서버 판이 다름(' + v + ' ≠ 13f584272b93) — node tools/build-judge.js 뒤 gs-judge 를 clasp push·deploy -i 로 다시 올릴 것'; } };
  return [ver].concat(list.map(function (s) {
    if (JUDGE_SEAM_NAMES_.indexOf(s.길) === -1) return s;
    return { 길: s.길 + ' (판정 서버)', fn: function () { var m = get(); if (m.err) return m.err; var x = m.r.filter(function (y) { return y.길 === s.길; })[0]; return x ? x.msg : '판정 서버에 이 줄이 없음(판정 서버를 다시 올릴 것)'; } };
  }));
}
