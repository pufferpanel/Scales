#!/bin/bash
#
# Minecraft Installer
# Written for Ubuntu Sysems
#
# ./minecraft_install.sh -u username [-p plugin -s sponge_version -f forge_version -v vanilla_version]

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root
plugin="vanilla"
spongeVersion="1.8-1371-2.1DEV-430"
forgeVersion="1.8-11.14.1.1334"
vanillaVersion="1.8.4"

while getopts ":u:s:f:p:v:" opt; do
    case "$opt" in
    u)
        username=$OPTARG
        ;;
    s)
        spongeVersion=$OPTARG
        ;;
    f)
        forgeVersion=$OPTARG
        ;;
    p)
        plugin=$OPTARG
        ;;
    v)
        vanillaVersion=$OPTARG
        ;;
    esac
done

if [ "$username" == "root" ]; then

    echo "WARNING: Invalid Username Supplied."
    exit 1

fi;

cd /home/$username/public

if [ "$plugin" == "spigot" ]; then

    # We will ignore -r for this since there is no easy way to do a specific version of Spigot.
    # To install a specific version the user should manually build and upload files.
    echo 'Downloading BuildTools for Spigot'
    echo "https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar"
    curl -o BuildTools.jar https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar

    git config --global --unset core.autocrlf
    java -jar BuildTools.jar
    
    echo 'Removing BuildTools Files and Folders...'
    mv spigot*.jar ../server.jar
    rm -rf *
    mv ../server.jar server.jar

elif [[ "$plugin" == "forge" || $plugin == "sponge-forge" ]]; then

    echo "Downloading Forge Version ${forgeVersion}";
    echo "http://files.minecraftforge.net/maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar"
    curl -o MinecraftForgeInstaller.jar http://files.minecraftforge.net/maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar

    java -jar MinecraftForgeInstaller.jar --installServer

    mv forge-${forgeVersion}-universal.jar server.jar
    rm -f MinecraftForgeInstaller.jar

    # Install Sponge Now
    if [ "$plugin" == "sponge-forge" ]; then

        mkdir mods
        cd mods

        echo "Installing Sponge Version ${spongeVersion}"
        echo "http://repo.spongepowered.org/maven/org/spongepowered/sponge/${spongeVersion}/sponge-${spongeVersion}.jar"
        curl -o sponge-${spongeVersion}.jar http://repo.spongepowered.org/maven/org/spongepowered/sponge/${spongeVersion}/sponge-${spongeVersion}.jar

    fi

elif [ "$plugin" == "sponge" ]; then

    echo 'Sponge Standalone is not currently suported in this version.';

elif [[ "$plugin" == "vanilla" ]]; then

    echo "Downloading Remote File..."
    echo "https://s3.amazonaws.com/Minecraft.Download/versions/${vanillaVersion}/minecraft_server.${vanillaVersion}.jar"
    curl -o server.jar https://s3.amazonaws.com/Minecraft.Download/versions/${vanillaVersion}/minecraft_server.${vanillaVersion}.jar

fi

echo 'Fixing permissions for downloaded files...'
chown -R ${username}:scalesuser *

echo 'Exiting Installer'
exit 0
