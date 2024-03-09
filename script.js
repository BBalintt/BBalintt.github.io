function sendEmail() {
    var name = document.getElementById("name").value;
    var jatszott = document.getElementById("jatszott").checked ? "Játszottam már" : "Nem játszottam még";
    var gameType = document.querySelector('input[name="j"]:checked') ? document.querySelector('input[name="j"]:checked').nextSibling.textContent : "Nincs kiválasztva";
    
    var emailBody = "Név: " + name + "%0A" +
                    "Játszott: " + jatszott + "%0A" +
                    "Játék típusa: " + gameType;
    var mailtoLink = 'mailto:'+document.getElementById("email").value+'?subject=Feedback&body=' + emailBody;
    window.location.href = mailtoLink;
}
function ena(){
    if(document.getElementById("jatszott").checked){
        for(var i=0;i<4;i++){
            document.getElementsByName("j")[i].disabled=false;
        }
    }
    else
    {
        for(var i=0;i<4;i++){
            document.getElementsByName("j")[i].disabled=true;
            document.getElementsByName("j")[i].checked=false;
        }
    }
}

function openModal() {
    document.getElementById("myModal").style.display = "block";
  }
  
  function closeModal() {
    document.getElementById("myModal").style.display = "none";
  }

  function openModal2() {
    document.getElementById("myModal2").style.display = "block";
  }
  
  function closeModal2() {
    document.getElementById("myModal2").style.display = "none";
  }
  var akad=false;
  function akadaly()
  {
    if(!akad)
    {
      document.body.style.color = "yellow";
      document.body.style.backgroundColor = "black";
      document.body.style.fontSize = "x-large";
      document.body.style.backgroundImage="none";
      akad=true;
    }
    else{
      document.body.style.color = "";
      document.body.style.backgroundColor = "";
      document.body.style.fontSize = "";
      document.body.style.backgroundImage='url("bg.jpg")';
      akad=false;
    }
  }
  var tartalom=false;
  function tart(){
    if(!tartalom)
    {
      document.getElementById("dndszov").innerHTML='<a href="dnd.html" >Dungeons and Dragons leírás</a>';
      document.getElementById("questszov").innerHTML='<a href="quest.html" >Quest leírás</a>';
      tartalom=true;
    }
    else{
      document.getElementById("dndszov").innerHTML='A Dungeons & Dragons egy fantasy témájú, narratíva-központú TTRPG, amely egy közepesen bonyolult szabályrendszerre épül, így kezdőknek és tapasztalt játékosoknak egyaránt megfelel. Az együttműködésen alapuló játékmenet a karakterek fejlődésére és a csoportos kalandokra összpontosít, ahol a Dungeon Master irányítja a történetet.';
      document.getElementById("questszov").innerHTML='A Quest egy könnyen elsajátítható, narratív központú TTRPG, amely egyszerűsített szabályrendszerrel és gyors karakteralkotási folyamattal hívja fel magára a figyelmet, ideális választás kezdőknek. A játék a történetmesélésre és a játékosok döntéseinek hatásaira helyezi a hangsúlyt, minimálisra csökkentve a bonyolult mechanikákat és a harci rendszert.';
      tartalom=false;
    }
  }