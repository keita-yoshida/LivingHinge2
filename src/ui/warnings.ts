import { state } from "../state";
import { board } from "../board";

export function renderWarnings(){
  const w=[];
  const colPat=!["hex","hexslit","spiral","tri"].includes(state.pattern);
  if(colPat&&state.p.gap<1) w.push({t:"ブリッジ幅が1mm未満です。薄い素材以外では破損しやすくなります。",e:false});
  else if(colPat&&state.p.gap<state.mat.thick) w.push({t:`ブリッジ幅が板厚（${state.mat.thick}mm）より小さくなっています。板厚の1〜1.5倍以上を推奨します。`,e:false});
  if(colPat&&state.p.pitch<3) w.push({t:"列の間隔が狭すぎると強度が大きく低下します。テストカットを推奨します。",e:false});
  if(state.pattern==="spiral"&&state.p.sw<Math.max(1.2,state.mat.thick*0.8)) w.push({t:"アーム幅が細いため取り扱い時に折れやすくなります。材料厚と同程度以上を推奨します。",e:false});
  if(state.mat.kind==="acr") w.push({t:"アクリルのリビングヒンジは割れやすい素材です。曲げ半径を大きめに取るか、加熱曲げと併用してください。",e:false});
  if(state.pattern==="spiral"&&state.p.cs<state.p.sw*4) w.push({t:"セルサイズに対してアーム幅が大きすぎるため、渦を生成できません。",e:true});
  if(state.pattern==="diamond"&&state.p.dw>=state.p.pitch-0.5) w.push({t:"ひし形の幅が列間隔に近すぎるため自動的に制限されています。",e:false});
  if(state.pattern==="cross"&&state.p.cw>=state.p.pitch-0.7) w.push({t:"横カット長が列間隔に近すぎるため自動的に制限されています。",e:false});
  if(state.pattern==="hexslit"&&state.p.hs<state.mat.thick*0.8) w.push({t:"六角形どうしの帯が細いため折れやすくなります。板厚と同程度以上を推奨します。",e:false});
  if(state.pattern==="hexslit") w.push({t:"内側の六角形の芯は切り抜かれて脱落します（このパターン本来の仕様です）。",e:false});
  if(state.pattern==="tri"&&state.p.td<state.mat.thick*0.4) w.push({t:"リング間隔が狭いため残る帯が細くなります。テストカットを推奨します。",e:false});
  if(state.pattern==="tri"&&state.margin<2) w.push({t:"入れ子三角は外周で小さな断片が脱落することがあります。余白2mm以上を推奨します。",e:false});
  if(board.cuts.length===0) w.push({t:"カットが生成されていません。サイズや余白の設定を確認してください。",e:true});
  if(board.cuts.length>4000) w.push({t:"カット数が非常に多くなっています。加工時間が長くなる場合があります。",e:false});
  else if(board.totalCutLen>20000) w.push({t:`総カット長が${(board.totalCutLen/1000).toFixed(1)}mと長大です。加工時間・レンズ加熱にご注意ください。`,e:false});
  document.getElementById("warns").innerHTML=
    w.map(x=>`<div class="warn-item${x.e?" err":""}">${x.t}</div>`).join("");
}
